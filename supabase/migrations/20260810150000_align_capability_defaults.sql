-- ==============================================================================
-- ALINEAR LOS DEFAULTS DE PERMISOS ENTRE POSTGRES Y LA APP
-- ==============================================================================
-- Los defaults viven en dos lados: `default_capability()` acá y `capabilities()`
-- en `lib/tenant/types.ts`. Estaban corridos y se notaba en pantalla:
--
--   · viewDojos          Postgres: superadmin + head_coach
--                        TypeScript: sólo superadmin
--     → al Coordinador regional no le aparecía "Academias" en el menú, cuando su
--       definición es justamente "ve todas las sedes".
--
--   · manageDojoSettings Postgres: superadmin + head_coach
--                        TypeScript: sólo superadmin
--     → la consola de permisos mostraba "heredado = sí" para un permiso que la
--       app le negaba.
--
-- Se toma como correcta la definición del modelo de roles: el Coordinador
-- regional VE todas las sedes pero no las configura ni toca finanzas. La app se
-- corrigió en el mismo commit para `viewDojos`; acá se corrige `manageDojoSettings`.
--
-- Vale la pena decirlo: tener los defaults escritos dos veces es una fuente de
-- este tipo de desfasaje. Mientras la RLS necesite evaluarlos en SQL y la UI en
-- el cliente, la duplicación es difícil de evitar; lo que sí se puede es dejar
-- las dos listas juntas y comentadas, que es lo que hace este archivo.
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
        -- Plata: el Mestre y el responsable de la academia. El Coordinador no.
        when 'viewFinance'        then p_role in ('superadmin', 'admin')
        else false
    end;
$$;

comment on function public.default_capability is
    'Defaults de permisos por rol. Debe coincidir con capabilities() en lib/tenant/types.ts.';
