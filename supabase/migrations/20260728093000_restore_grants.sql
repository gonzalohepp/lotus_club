-- ==============================================================================
-- RESTAURAR GRANTS — el restore con --no-privileges los borró
-- ==============================================================================
-- En Postgres, el acceso a una tabla necesita DOS cosas:
--   1. GRANT   → "este rol puede tocar esta tabla"
--   2. RLS     → "estas filas, y no otras"
--
-- Un `pg_restore --no-privileges` (lo que recomendaba SETUP-MULTITENANT.md)
-- descarta los GRANT del dump. Resultado: las políticas RLS de las migraciones
-- multi-tenant quedaron aplicadas, pero `authenticated` y `service_role` no
-- tienen permiso sobre las tablas heredadas, así que todo devuelve
-- "42501 permission denied" antes siquiera de evaluar RLS.
--
-- Se nota porque las únicas tablas que respondían eran `dojos`,
-- `dojo_members`, `organizations` y `platform_admins`: las creadas por estas
-- migraciones, que sí traían su GRANT explícito.
--
-- Este archivo restaura los privilegios. NO afloja la seguridad: el filtrado
-- sigue siendo 100% de RLS, que ya está activa en todas las tablas
-- (verificado: 0 filas en la consulta de tablas sin RLS).
-- ==============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- anon — sólo lectura
-- ------------------------------------------------------------------------------
-- La landing pública lee sedes, clases y academias. RLS decide QUÉ filas ve;
-- sin políticas para `anon` en una tabla, el SELECT devuelve vacío aunque el
-- grant exista. Por eso alcanza con SELECT global y no hace falta enumerar.
grant select on all tables in schema public to anon;

-- Única escritura anónima: la analítica de la landing.
do $$
begin
    if to_regclass('public.landing_events') is not null then
        execute 'grant insert on public.landing_events to anon';
        execute 'grant usage, select on all sequences in schema public to anon';
    end if;
end $$;

-- ------------------------------------------------------------------------------
-- authenticated — operativa completa, acotada por RLS
-- ------------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ------------------------------------------------------------------------------
-- service_role — usado por las API routes del servidor y los edge functions
-- ------------------------------------------------------------------------------
-- Bypassea RLS por configuración de rol, pero igual necesita el GRANT.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- ------------------------------------------------------------------------------
-- Default privileges — para que las tablas FUTURAS no repitan el problema
-- ------------------------------------------------------------------------------
-- Sin esto, cada tabla nueva creada por `postgres` nace sin grants y hay que
-- acordarse de otorgarlos a mano. Replica el comportamiento de fábrica de
-- Supabase.
alter default privileges in schema public
    grant select on tables to anon;

alter default privileges in schema public
    grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
    grant all on tables to service_role;

alter default privileges in schema public
    grant usage, select on sequences to anon, authenticated;

alter default privileges in schema public
    grant all on sequences to service_role;

alter default privileges in schema public
    grant execute on functions to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Tablas de public donde `authenticated` NO puede leer — debe devolver 0 filas:
--
--   select c.relname
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r'
--     and not has_table_privilege('authenticated', c.oid, 'SELECT')
--   order by 1;
