-- ==============================================================================
-- MULTI-TENANT CORE — Organizaciones, Dojos, Membresías por dojo
-- ==============================================================================
-- Convierte el sistema single-tenant (1 dojo por instancia de Supabase) en una
-- plataforma multi-marca:
--
--   organizations (Lotus, Beleza, ...)
--     └── dojos (Lotus Lanús, Lotus Avellaneda, ...)
--           └── dojo_members (persona ↔ dojo, con rol POR DOJO)
--
-- Reglas de negocio que soporta este schema:
--   * Cada dojo tiene sus propias clases, horarios, alumnos, pagos y admins.
--   * Un admin de Lanús NO ve nada de Avellaneda.
--   * Un alumno puede estar en N dojos (lunes en Lanús, viernes en Avellaneda)
--     y ve todo dojo donde tenga una membresía activa.
--   * Un platform admin (el dev / dueño de la plataforma) ve absolutamente todo.
--   * Cada dojo define su propia lógica de vencimiento, recargo y bloqueo.
--
-- IMPORTANTE sobre el "dojo activo": este schema NO guarda un dojo activo en la
-- sesión. RLS es el borde de SEGURIDAD (qué dojos podés ver como máximo) y el
-- filtro por dojo activo es de APLICACIÓN (`.eq('dojo_id', activeDojoId)`).
-- Mezclar ambos en RLS lleva a bugs de "no veo mis datos" difíciles de depurar.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Roles dentro de un dojo
-- ------------------------------------------------------------------------------
-- Distinto de public.user_role (rol global heredado del sistema single-tenant).
-- Acá el rol es POR DOJO: la misma persona puede ser admin en Lanús y alumno en
-- Avellaneda.
do $$
begin
    if not exists (select 1 from pg_type where typname = 'dojo_role') then
        create type public.dojo_role as enum (
            'owner',       -- dueño del dojo: todo sobre su dojo, incluida la config de cobro
            'admin',       -- administra el día a día del dojo
            'instructor',  -- ve alumnos y asistencia, no toca plata ni config
            'member',      -- alumno
            'becado'       -- alumno exento de cuota
        );
    end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. Organizaciones (la marca / red)
-- ------------------------------------------------------------------------------
create table if not exists public.organizations (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique,
    name        text not null,

    -- Plan comercial de la organización. Reemplaza NEXT_PUBLIC_PLAN: ya no hace
    -- falta redeploy para cambiar de plan.
    plan        text not null default 'basic' check (plan in ('basic', 'pro')),

    -- Overrides puntuales sobre los defaults del plan, ej: {"metrics": true}
    -- para habilitar métricas a un cliente Basic sin subirlo a Pro.
    features    jsonb not null default '{}'::jsonb,

    -- {"primary":"#1E40AF","accent":"#F59E0B","logo_url":"...","favicon":"..."}
    branding    jsonb not null default '{}'::jsonb,

    is_active   boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on column public.organizations.features is
    'Overrides sobre FEATURES_BY_PLAN. Sólo las claves presentes pisan al plan.';

-- ------------------------------------------------------------------------------
-- 3. Dojos (las sedes)
-- ------------------------------------------------------------------------------
create table if not exists public.dojos (
    id          uuid primary key default gen_random_uuid(),
    org_id      uuid not null references public.organizations(id) on delete cascade,
    slug        text not null,
    name        text not null,

    -- Datos de sede (lo que hoy vive en `academies` para el mapa público)
    city        text,
    address     text,
    lat         double precision,
    lng         double precision,
    phone       text,
    timezone    text not null default 'America/Argentina/Buenos_Aires',

    -- Override opcional del branding de la org (un dojo con su propio color).
    -- Vacío = hereda de la organización.
    branding    jsonb not null default '{}'::jsonb,

    -- Lógica de cobro PROPIA de este dojo. Ver 20260727120200_billing_engine.sql
    -- para la forma completa y el motor que la interpreta.
    billing     jsonb not null default jsonb_build_object(
        'due_day', 10,
        'tiers', jsonb_build_array(
            jsonb_build_object('from_day', 1,  'to_day', 10,   'surcharge_pct', 0,  'blocks_access', false, 'label', 'Sin recargo'),
            jsonb_build_object('from_day', 11, 'to_day', 19,   'surcharge_pct', 20, 'blocks_access', false, 'label', 'Con recargo'),
            jsonb_build_object('from_day', 20, 'to_day', null, 'surcharge_pct', 20, 'blocks_access', true,  'label', 'Bloqueado')
        ),
        'months_overdue_blocks', 2,
        'exempt_roles', jsonb_build_array('owner', 'admin', 'instructor', 'becado'),
        'new_member_exempt', true,
        'currency', 'ARS',
        'rounding', 0
    ),

    is_active   boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    unique (org_id, slug)
);

create index if not exists dojos_org_id_idx on public.dojos (org_id);

comment on column public.dojos.billing is
    'Reglas de cobro del dojo (vencimiento, recargos, bloqueo). Las define el dueño de cada dojo.';

-- ------------------------------------------------------------------------------
-- 4. Membresía persona ↔ dojo
-- ------------------------------------------------------------------------------
-- El corazón del multi-tenant. `profiles` sigue siendo GLOBAL (una persona =
-- un auth.user = un profile con nombre, email, foto). Lo que se multiplica es
-- la pertenencia: una fila por cada dojo al que esa persona pertenece, con su
-- rol en ese dojo.
create table if not exists public.dojo_members (
    id          uuid primary key default gen_random_uuid(),
    dojo_id     uuid not null references public.dojos(id) on delete cascade,
    user_id     uuid not null references auth.users(id) on delete cascade,
    role        public.dojo_role not null default 'member',
    is_active   boolean not null default true,
    joined_at   date not null default current_date,
    -- Código de acceso QR por dojo (puede diferir entre sedes)
    access_code text,
    notes       text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    unique (dojo_id, user_id)
);

create index if not exists dojo_members_user_id_idx on public.dojo_members (user_id);
create index if not exists dojo_members_dojo_id_idx on public.dojo_members (dojo_id);
create index if not exists dojo_members_dojo_role_idx on public.dojo_members (dojo_id, role) where is_active;

-- ------------------------------------------------------------------------------
-- 5. Platform admins (superusuario / dev)
-- ------------------------------------------------------------------------------
-- Ve y administra TODAS las organizaciones. Es la tabla que habilita /superadmin.
create table if not exists public.platform_admins (
    user_id     uuid primary key references auth.users(id) on delete cascade,
    note        text,
    created_at  timestamptz not null default now()
);

-- ==============================================================================
-- 6. HELPERS DE TENANT
-- ==============================================================================
-- Todos SECURITY DEFINER + search_path fijo: las políticas RLS los invocan, y si
-- leyeran las tablas con RLS activa se produciría recursión infinita
-- (dojo_members se protege a sí misma consultando dojo_members).
-- STABLE permite a Postgres cachearlos dentro de la misma query.
-- ------------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.platform_admins where user_id = auth.uid()
    );
$$;

comment on function public.is_platform_admin() is
    'true si el usuario actual es superusuario de la plataforma (ve todas las orgs).';

-- Dojos donde el usuario tiene CUALQUIER vínculo activo (alumno incluido).
create or replace function public.my_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(dm.dojo_id), '{}'::uuid[])
    from public.dojo_members dm
    where dm.user_id = auth.uid()
      and dm.is_active;
$$;

-- Dojos donde el usuario es STAFF (owner/admin/instructor). Es el conjunto que
-- habilita leer datos de OTRAS personas.
create or replace function public.my_staff_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(dm.dojo_id), '{}'::uuid[])
    from public.dojo_members dm
    where dm.user_id = auth.uid()
      and dm.is_active
      and dm.role in ('owner', 'admin', 'instructor');
$$;

-- Dojos donde el usuario puede MODIFICAR configuración (owner/admin).
-- Los instructores quedan afuera a propósito: ven alumnos, no tocan config ni plata.
create or replace function public.my_manager_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(dm.dojo_id), '{}'::uuid[])
    from public.dojo_members dm
    where dm.user_id = auth.uid()
      and dm.is_active
      and dm.role in ('owner', 'admin');
$$;

-- Predicado central de RLS: "¿puedo ver datos de terceros en este dojo?"
create or replace function public.can_read_dojo(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.is_platform_admin() or target = any (public.my_staff_dojo_ids());
$$;

-- Predicado central de escritura/config.
create or replace function public.can_manage_dojo(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.is_platform_admin() or target = any (public.my_manager_dojo_ids());
$$;

-- ¿El usuario pertenece al dojo, en cualquier rol? (para lecturas de lo propio)
create or replace function public.belongs_to_dojo(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.is_platform_admin() or target = any (public.my_dojo_ids());
$$;

-- ------------------------------------------------------------------------------
-- 7. updated_at automático
-- ------------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists organizations_touch on public.organizations;
create trigger organizations_touch before update on public.organizations
    for each row execute function public.touch_updated_at();

drop trigger if exists dojos_touch on public.dojos;
create trigger dojos_touch before update on public.dojos
    for each row execute function public.touch_updated_at();

drop trigger if exists dojo_members_touch on public.dojo_members;
create trigger dojo_members_touch before update on public.dojo_members
    for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------------------
-- 8. Grants
-- ------------------------------------------------------------------------------
grant select on public.organizations to anon, authenticated;
grant select on public.dojos to anon, authenticated;
grant select on public.dojo_members to authenticated;
grant select on public.platform_admins to authenticated;
grant all on public.organizations, public.dojos, public.dojo_members, public.platform_admins to service_role;
