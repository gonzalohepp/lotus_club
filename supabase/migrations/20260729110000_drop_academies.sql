-- ==============================================================================
-- ELIMINAR LA TABLA `academies`
-- ==============================================================================
-- `academies` existía en el sistema single-tenant sólo para el mapa de la
-- landing. Con el multi-tenant, una sede ES un `dojo`: tiene alumnos, clases,
-- pagos y lógica de cobro propios, y el mapa lee de ahí.
--
-- La tabla quedó en paralelo, sin sincronizar, y eso ya causó un problema real:
-- el panel de Academias mostraba "no hay academias registradas" mientras había
-- 34 sedes cargadas, porque leía la tabla vieja.
--
-- Ya no la consulta nadie: `/admin/academies` y `AcademiesMapSection` leen
-- `dojos`, y los componentes que la escribían (`AcademyList`, `AcademyModal`)
-- fueron eliminados. Era además la única tabla que quedaba con una policy
-- `USING (true)`.
--
-- Las filas que tenía se migraron a `dojos` en 20260727120100.
-- ==============================================================================

drop table if exists public.academies cascade;

-- `unaccent_fallback` se creó sólo para derivar los slugs en esa migración.
drop function if exists public.unaccent_fallback(text);

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Ya no debe quedar ninguna policy que deje pasar todo:
--
--   select c.relname, p.polname from pg_policy p
--   join pg_class c on c.oid = p.polrelid
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and pg_get_expr(p.polqual, p.polrelid) = 'true';
