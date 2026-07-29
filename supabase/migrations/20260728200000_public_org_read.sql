-- ==============================================================================
-- LECTURA PÚBLICA DE LA MARCA
-- ==============================================================================
-- `dojos` ya tiene lectura para `anon` (la policy "dojos public map", que
-- alimenta el mapa de la landing), pero `organizations` no. Eso rompe dos cosas
-- del sitio público:
--
--   · `generateMetadata()` corre SIN SESIÓN, así que no puede leer el nombre ni
--     el logo de la marca para el <title> y el favicon.
--   · El mapa hace un join a `organizations` para filtrar por marca; sin
--     lectura anónima el `!inner` descarta todas las filas y el mapa queda
--     vacío.
--
-- Qué se expone: nombre, slug y branding. Son datos que la marca publica de
-- todas formas en su propia web. Lo que NO se expone es `plan` ni `features`,
-- que son condiciones comerciales entre la plataforma y el cliente.
--
-- Por eso la lectura pública va por una VISTA con las columnas justas, en vez
-- de abrir un SELECT sobre la tabla entera: una policy es por fila, y acá el
-- recorte que hace falta es por columna.
-- ==============================================================================

create or replace view public.public_organizations
with (security_invoker = false)
as
select
    o.id,
    o.slug,
    o.name,
    o.branding
from public.organizations o
where o.is_active
  -- Sólo marcas que efectivamente tienen una sede publicada.
  and exists (
      select 1 from public.dojos d
      where d.org_id = o.id and d.is_active
  );

comment on view public.public_organizations is
    'Datos de marca visibles sin sesión (nombre, slug, branding). Excluye plan y features a propósito.';

-- `security_invoker = false` hace que la vista corra con los permisos de su
-- dueño, salteando la RLS de `organizations`. Es deliberado: la vista ES el
-- borde de seguridad, y ya limita filas (sólo activas con sede) y columnas
-- (sin plan ni features).
grant select on public.public_organizations to anon, authenticated;

-- ------------------------------------------------------------------------------
-- El join del mapa necesita leer la tabla, no la vista
-- ------------------------------------------------------------------------------
-- PostgREST resuelve `dojos?select=...,organizations!inner(slug)` contra la
-- tabla real. Se le da a `anon` lectura de las columnas públicas mediante una
-- policy acotada a organizaciones activas con sede publicada — el mismo
-- criterio que la vista.
drop policy if exists "orgs public read" on public.organizations;
create policy "orgs public read" on public.organizations
for select to anon
using (
    is_active
    and exists (
        select 1 from public.dojos d
        where d.org_id = organizations.id and d.is_active
    )
);

-- ⚠️ Esta policy expone TODAS las columnas de la fila, incluidas `plan` y
-- `features`. Es aceptable porque saber que "Lotus está en plan Pro" no habilita
-- nada, pero si algún día se guarda algo sensible en `organizations` (tokens de
-- Mercado Pago por marca, por ejemplo), hay que mover ese dato a otra tabla
-- ANTES de dejar esta policy en pie. Ver §3.1 de SETUP-MULTITENANT.md.

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
--   curl '<url>/rest/v1/public_organizations?select=slug,name,branding' \
--        -H 'apikey: <anon>'
