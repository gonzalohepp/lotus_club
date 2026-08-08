-- ==============================================================================
-- PERMISOS POR ROL, EDITABLES POR ORGANIZACIÓN
-- ==============================================================================
-- Hasta acá el mapa rol → permisos vivía sólo en código (`capabilities()` en
-- lib/tenant/types.ts). Cambiar qué ve un instructor implicaba tocar el código y
-- desplegar.
--
-- Esta tabla NO reemplaza esos defaults: los PISA cuando hay una fila. Sin
-- filas, todo se comporta exactamente como hoy. Eso mantiene el sistema seguro
-- por omisión: una organización nueva arranca con los permisos del código, no
-- con una matriz vacía.
--
-- QUÉ NO ES EDITABLE, Y POR QUÉ
-- `platformConsole`, `manageDojos`, `manageOrgAdmins` y `manageBilling` son de
-- la PLATAFORMA, no del cliente. Si una marca pudiera tildarse `manageBilling`
-- se autoasignaría las reglas de recargo y bloqueo de sus propios alumnos, y
-- si pudiera tildarse `platformConsole` vería a los demás clientes. Se rechazan
-- con un CHECK acá, no sólo escondiéndolos de la UI.
-- ==============================================================================

create table if not exists public.role_capabilities (
    org_id     uuid not null references public.organizations(id) on delete cascade,
    /* Rol al que aplica. Se guarda como texto y no como enum porque conviven
       roles de dos enums distintos (org_role y dojo_role). */
    role       text not null check (role in (
        'superadmin', 'head_coach', 'manager',   -- org_role
        'admin', 'instructor', 'member', 'becado' -- dojo_role
    )),
    capability text not null check (capability in (
        'viewDojos', 'manageDojoSettings', 'manageMembers', 'viewFinance'
    )),
    enabled    boolean not null,
    updated_at timestamptz not null default now(),
    updated_by uuid references public.profiles(user_id) on delete set null,
    primary key (org_id, role, capability)
);

comment on table public.role_capabilities is
    'Overrides de permisos por organización. Sin fila, rige el default del código. '
    'Las capacidades de plataforma (consola, alta de sedes, cobro) no se pueden '
    'delegar y por eso no figuran en el CHECK.';

-- ------------------------------------------------------------------------------
-- Resolución: override si existe, si no el default
-- ------------------------------------------------------------------------------
-- Los defaults se replican acá para que la BASE pueda decidir sin depender del
-- cliente. Tienen que coincidir con `capabilities()` en types.ts — es el precio
-- de que el permiso valga también cuando alguien pega contra la API directo.
create or replace function public.default_capability(p_role text, p_capability text)
returns boolean
language sql
immutable
as $$
    select case p_capability
        when 'viewDojos'          then p_role in ('superadmin', 'head_coach')
        when 'manageDojoSettings' then p_role in ('superadmin', 'head_coach')
        when 'manageMembers'      then p_role in ('superadmin', 'head_coach', 'manager', 'admin')
        when 'viewFinance'        then p_role in ('superadmin', 'admin')
        else false
    end;
$$;

create or replace function public.has_capability(p_org uuid, p_role text, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(
        (select rc.enabled
         from public.role_capabilities rc
         where rc.org_id = p_org and rc.role = p_role and rc.capability = p_capability),
        public.default_capability(p_role, p_capability)
    );
$$;

comment on function public.has_capability(uuid, text, text) is
    'Permiso efectivo: el override de la organización si existe, si no el default.';

-- ------------------------------------------------------------------------------
-- Enganchar el primer permiso a la RLS de verdad
-- ------------------------------------------------------------------------------
-- `can_read_finance` deja de ser una lista fija de roles y pasa a preguntar por
-- el permiso efectivo. Así, destildar "viewFinance" en la consola le corta los
-- pagos al rol de verdad, no sólo en el menú.
create or replace function public.my_finance_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(distinct d.id), '{}'::uuid[])
    from public.dojos d
    where
        -- rol de marca sobre la organización de la sede
        exists (
            select 1 from public.org_members om
            where om.user_id = auth.uid()
              and om.is_active
              and om.org_id = d.org_id
              and public.has_capability(d.org_id, om.role::text, 'viewFinance')
        )
        -- o rol dentro de la sede
        or exists (
            select 1 from public.dojo_members dm
            where dm.dojo_id = d.id
              and dm.user_id = auth.uid()
              and dm.is_active
              and public.has_capability(d.org_id, dm.role::text, 'viewFinance')
        );
$$;

-- ------------------------------------------------------------------------------
-- RLS de la tabla de permisos
-- ------------------------------------------------------------------------------
-- Leer: cualquiera de la organización (el cliente necesita resolver su menú).
-- Escribir: SÓLO el desarrollador. Si un superadmin pudiera editarla, se
-- autoasignaría permisos, que es justamente lo que la tabla debe impedir.
alter table public.role_capabilities enable row level security;

drop policy if exists "role_capabilities read" on public.role_capabilities;
create policy "role_capabilities read" on public.role_capabilities
for select to authenticated
using (org_id = any (public.my_org_ids()) or public.is_platform_admin());

drop policy if exists "role_capabilities write" on public.role_capabilities;
create policy "role_capabilities write" on public.role_capabilities
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());
