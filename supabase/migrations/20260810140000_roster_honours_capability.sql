-- ==============================================================================
-- `can_manage_roster` PASA A MIRAR EL PERMISO EFECTIVO
-- ==============================================================================
-- La migración anterior dejó `can_manage_roster()` como una lista fija: admin de
-- la sede o desarrollador. Funciona, pero rompe la promesa de la consola de
-- permisos: ahí se puede tildar "Gestionar alumnos" para el Mestre, la UI se lo
-- creería (`capabilities()` sí consulta los overrides) y la base seguiría
-- diciendo que no. Resultado: aparece el botón "Nuevo Alumno" y el guardado
-- falla con 42501.
--
-- Se resuelve igual que con `viewFinance` en 20260807140000: el predicado deja
-- de enumerar roles y pregunta por el permiso efectivo, que es el override de la
-- organización si existe y el default si no.
--
-- Los defaults de `manageMembers` cambian en consecuencia: los roles de MARCA
-- salen de la lista. Ver `20260810120000_brand_roles_read_only.sql`.
-- ==============================================================================

create or replace function public.default_capability(p_role text, p_capability text)
returns boolean
language sql
immutable
as $$
    select case p_capability
        when 'viewDojos'          then p_role in ('superadmin', 'head_coach')
        when 'manageDojoSettings' then p_role in ('superadmin', 'head_coach')
        -- Alumnos y clases: sólo el responsable de la academia. Mestre y
        -- Coordinador regional los ven todos, en modo lectura.
        when 'manageMembers'      then p_role in ('admin')
        when 'viewFinance'        then p_role in ('superadmin', 'admin')
        else false
    end;
$$;

-- Sedes donde la persona puede ESCRIBIR alumnos y clases, según el permiso
-- efectivo. Mismo patrón que `my_finance_dojo_ids()`.
create or replace function public.my_roster_dojo_ids()
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
              and public.has_capability(d.org_id, om.role::text, 'manageMembers')
        )
        -- o rol dentro de la sede
        or exists (
            select 1 from public.dojo_members dm
            where dm.dojo_id = d.id
              and dm.user_id = auth.uid()
              and dm.is_active
              and public.has_capability(d.org_id, dm.role::text, 'manageMembers')
        );
$$;

comment on function public.my_roster_dojo_ids is
    'Sedes donde se pueden escribir alumnos y clases, según el permiso efectivo de la organización.';

create or replace function public.can_manage_roster(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.is_platform_admin() or target = any (public.my_roster_dojo_ids());
$$;

comment on function public.can_manage_roster is
    'Escritura de alumnos y clases. Respeta los overrides de la consola de permisos.';

-- `my_sede_admin_dojo_ids()` queda en la base: la usa el trigger del modo del QR
-- a través de can_manage_roster y sirve como "admin real de la sede" para
-- cualquier chequeo que no deba ser configurable.

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Por defecto, con el token de brandadmin (Mestre):
--   update public.classes set name = name where dojo_id = '<sede>';   → 0 filas
--
-- Tildando "Gestionar alumnos" para superadmin en la consola:
--   insert into public.role_capabilities (org_id, role, capability, enabled)
--   values ('<org>', 'superadmin', 'manageMembers', true);
--   → el mismo update pasa a afectar filas, y el botón de la UI aparece.
