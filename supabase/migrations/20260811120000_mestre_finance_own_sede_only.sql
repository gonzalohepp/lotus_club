-- ==============================================================================
-- EL MESTRE NO VE LA RECAUDACIÓN DE LA RED, SÓLO LA DE SU PROPIA SEDE
-- ==============================================================================
-- Decisión de producto (Gonzalo, 29/07/2026), que corrige lo que habíamos
-- resuelto al revés y coincide con lo que pedía el informe de evaluación:
--
--   "el Mestre no ve la plata salvo que sea administrador de una sede,
--    y ve lo de su sede"
--
-- Hasta acá `viewFinance` era true por default para el rol de marca
-- `superadmin`, así que el Mestre veía Pagos y Métricas de TODAS las sucursales.
-- El modelo nuevo es más simple de explicar: la plata es de la sede, y la ve
-- quien la administra. Que además seas Mestre no cambia nada.
--
-- Cómo queda, sin tocar ninguna otra función:
--
--   · `my_finance_dojo_ids()` arma su lista por dos caminos, el rol de marca y
--     el rol dentro de la sede. Sacando `superadmin` del default, el primer
--     camino deja de darle sedes al Mestre y sólo le quedan aquellas donde
--     tiene fila propia en `dojo_members` con rol `admin`.
--
--   · `can_manage_payments()` ya exigía `my_sede_admin_dojo_ids()` (admin con
--     membresía propia) Y `can_read_finance()`. Con el cambio, el Mestre que
--     dirige su academia sigue pudiendo cobrar ahí, que es lo pedido.
--
--   · El Coordinador regional no se mueve: nunca tuvo finanzas.
--
-- El espejo de esto en la app es `capabilities()` en `lib/tenant/types.ts`.
-- ==============================================================================

create or replace function public.default_capability(p_role text, p_capability text)
returns boolean
language sql
immutable
as $$
    select case p_capability
        -- Ver el listado de sedes de la marca. Los dos roles de marca.
        when 'viewDojos'          then p_role in ('superadmin', 'head_coach')
        -- Configurar la sede (datos, equipo, branding). Sólo el Mestre: el
        -- Coordinador regional acompaña lo deportivo, no administra la ficha.
        when 'manageDojoSettings' then p_role in ('superadmin')
        -- Alumnos y clases: sólo el responsable de la academia.
        when 'manageMembers'      then p_role in ('admin')
        -- Plata: SÓLO el responsable de la academia, sobre su propia sede.
        -- `admin` es el rol de sede (fila en `dojo_members`), no el de marca.
        when 'viewFinance'        then p_role in ('admin')
        else false
    end;
$$;

comment on function public.default_capability is
    'Defaults de permisos por rol. Debe coincidir con capabilities() en lib/tenant/types.ts.';

-- ------------------------------------------------------------------------------
-- Limpiar overrides que resucitarían el comportamiento viejo
-- ------------------------------------------------------------------------------
-- `has_capability()` le da prioridad al override de la organización sobre el
-- default. Si alguna marca tiene una fila que le prende `viewFinance` al rol
-- `superadmin`, el cambio de arriba no tendría efecto para esa marca y el bug
-- volvería en silencio. Se borran esas filas: la decisión es que el default
-- mande. Si más adelante una marca quiere devolvérselo al Mestre, se vuelve a
-- tildar desde la consola de permisos, que es lo que esa consola existe para
-- hacer.
delete from public.role_capabilities
where role = 'superadmin'
  and capability = 'viewFinance';

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Con el token de un Mestre que NO tiene fila en `dojo_members`:
--   select * from public.payments;                    → 0 filas
--   select public.can_read_finance('<sede-cualquiera>');  → false
--
-- Con el token de un Mestre que SÍ es admin de una sede:
--   select public.can_read_finance('<su-sede>');      → true
--   select public.can_read_finance('<otra-sede>');    → false
--   select public.can_manage_payments('<su-sede>');   → true
