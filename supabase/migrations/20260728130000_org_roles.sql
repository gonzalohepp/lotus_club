-- ==============================================================================
-- ROL DE ORGANIZACIÓN — el "superadmin" de una marca
-- ==============================================================================
-- Faltaba un nivel intermedio. Hasta acá había dos:
--
--   platform_admins  → el desarrollador: TODAS las organizaciones + /superadmin
--   dojo_members     → roles dentro de UNA sede
--
-- Pero el dueño de Lotus no es ninguno de los dos: tiene que ver las 20
-- sucursales de Lotus, dar de alta sedes nuevas y usar todo el panel, sin
-- acceder a la consola de plataforma (donde vería a Beleza y al resto de los
-- clientes).
--
-- Jerarquía final:
--
--   desarrollador   platform_admins            todas las orgs + /superadmin
--   superadmin      org_members                todas las sedes de SU org
--   dueño de sede   dojo_members 'owner'       su sede, incluida la config de cobro
--   administrador   dojo_members 'admin'       su sede, sin gestión de sedes
--   profesor        dojo_members 'instructor'  alumnos y asistencia de su sede
--   alumno          dojo_members 'member'      sólo lo propio
-- ==============================================================================

do $$
begin
    if not exists (select 1 from pg_type where typname = 'org_role') then
        create type public.org_role as enum (
            'superadmin',  -- dueño de la marca: todas las sedes de su organización
            'manager'      -- staff de la marca: ve todas las sedes, no crea ni borra
        );
    end if;
end $$;

create table if not exists public.org_members (
    id         uuid primary key default gen_random_uuid(),
    org_id     uuid not null references public.organizations(id) on delete cascade,
    user_id    uuid not null references auth.users(id) on delete cascade,
    role       public.org_role not null default 'superadmin',
    is_active  boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (org_id, user_id)
);

create index if not exists org_members_user_idx on public.org_members (user_id) where is_active;
create index if not exists org_members_org_idx  on public.org_members (org_id);

drop trigger if exists org_members_touch on public.org_members;
create trigger org_members_touch before update on public.org_members
    for each row execute function public.touch_updated_at();

-- ==============================================================================
-- HELPERS
-- ==============================================================================

/** Organizaciones donde la persona tiene un rol de marca. */
create or replace function public.my_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(om.org_id), '{}'::uuid[])
    from public.org_members om
    where om.user_id = auth.uid()
      and om.is_active;
$$;

/** Organizaciones donde puede CREAR y BORRAR sedes (sólo 'superadmin'). */
create or replace function public.my_owned_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(om.org_id), '{}'::uuid[])
    from public.org_members om
    where om.user_id = auth.uid()
      and om.is_active
      and om.role = 'superadmin';
$$;

create or replace function public.is_org_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.is_platform_admin() or target = any (public.my_owned_org_ids());
$$;

-- ------------------------------------------------------------------------------
-- Los helpers de dojo ahora heredan del nivel de organización
-- ------------------------------------------------------------------------------
-- Un superadmin de Lotus es staff de TODA sede de Lotus, sin necesitar una fila
-- en `dojo_members` por cada una. Como estas funciones son las que usan todas
-- las políticas RLS, con redefinirlas acá la herencia aplica en toda la base sin
-- tocar una sola policy.

create or replace function public.my_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(distinct d.id), '{}'::uuid[])
    from public.dojos d
    where d.org_id = any (public.my_org_ids())
       or exists (
            select 1 from public.dojo_members dm
            where dm.dojo_id = d.id
              and dm.user_id = auth.uid()
              and dm.is_active
       );
$$;

create or replace function public.my_staff_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(distinct d.id), '{}'::uuid[])
    from public.dojos d
    where d.org_id = any (public.my_org_ids())
       or exists (
            select 1 from public.dojo_members dm
            where dm.dojo_id = d.id
              and dm.user_id = auth.uid()
              and dm.is_active
              and dm.role in ('owner', 'admin', 'instructor')
       );
$$;

create or replace function public.my_manager_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(distinct d.id), '{}'::uuid[])
    from public.dojos d
    where d.org_id = any (public.my_owned_org_ids())
       or exists (
            select 1 from public.dojo_members dm
            where dm.dojo_id = d.id
              and dm.user_id = auth.uid()
              and dm.is_active
              and dm.role in ('owner', 'admin')
       );
$$;

-- ==============================================================================
-- RLS
-- ==============================================================================
alter table public.org_members enable row level security;

drop policy if exists "org_members read" on public.org_members;
create policy "org_members read" on public.org_members
for select to authenticated
using (
    user_id = auth.uid()                            -- mis propias membresías de marca
    or public.is_platform_admin()
    or org_id = any (public.my_org_ids())           -- el staff de la marca se ve entre sí
);

-- Alta y baja de superadmins de una marca: el desarrollador, o un superadmin
-- ya existente de esa misma organización.
drop policy if exists "org_members manage" on public.org_members;
create policy "org_members manage" on public.org_members
for all to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

-- ------------------------------------------------------------------------------
-- El superadmin puede crear sedes en SU organización
-- ------------------------------------------------------------------------------
-- Antes crear dojos era exclusivo del platform admin. Ahora el dueño de la marca
-- da de alta sus propias sucursales, pero sólo dentro de su organización: el
-- WITH CHECK sobre org_id impide que se cree una sede colgando de otra marca.
drop policy if exists "dojos manage org" on public.dojos;
create policy "dojos manage org" on public.dojos
for all to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

grant select, insert, update, delete on public.org_members to authenticated;
grant all on public.org_members to service_role;

-- ==============================================================================
-- Backfill: los owners de sede pasan a superadmin de su organización
-- ==============================================================================
-- Quien ya era dueño de una sede es, en la práctica, el dueño de la marca en
-- este staging. Si una organización tiene varias sedes con dueños distintos,
-- revisá a mano después.
-- El cast a `::public.org_role` es obligatorio: en INSERT ... SELECT, Postgres
-- no infiere el literal como enum (sí lo hace en INSERT ... VALUES), y falla
-- con 42804 "column role is of type org_role but expression is of type text".
insert into public.org_members (org_id, user_id, role)
select distinct d.org_id, dm.user_id, 'superadmin'::public.org_role
from public.dojo_members dm
join public.dojos d on d.id = dm.dojo_id
where dm.role = 'owner' and dm.is_active
on conflict (org_id, user_id) do nothing;

-- ==============================================================================
-- Verificación
-- ==============================================================================
--   select o.name as org, p.email, om.role
--   from public.org_members om
--   join public.organizations o on o.id = om.org_id
--   join public.profiles p on p.user_id = om.user_id
--   order by 1, 2;
