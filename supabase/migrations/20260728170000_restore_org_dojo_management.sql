-- ==============================================================================
-- EL SUPERADMIN VUELVE A ADMINISTRAR LAS SEDES DE SU MARCA
-- ==============================================================================
-- Revierte 20260728160000, que había dejado el alta de sedes exclusiva del
-- desarrollador. El superadmin de una organización da de alta y edita sus
-- propias sucursales.
--
-- Lo que NO vuelve: la edición de `dojos.billing`. Sigue siendo del
-- desarrollador, garantizada por el trigger `enforce_billing_dev_only()`
-- (20260728150000), que es justamente el motivo por el que ese trigger se
-- escribió como restricción de COLUMNA y no de fila: permite devolver el UPDATE
-- sobre la tabla sin reabrir la lógica de cobro.
--
-- Tampoco vuelve `"dojos update own"`: un administrador de sucursal no edita la
-- ficha de su sede. Eso es de la marca.
-- ==============================================================================

drop policy if exists "dojos manage org" on public.dojos;
create policy "dojos manage org" on public.dojos
for all to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

-- ------------------------------------------------------------------------------
-- Quién es superadmin lo decide el desarrollador
-- ------------------------------------------------------------------------------
-- La policy anterior usaba `is_org_admin(org_id)`, con lo cual un superadmin
-- podía nombrar a otro superadmin de su marca. Eso hace que el control de una
-- cuenta se propague sin que la plataforma lo autorice, y que darle de baja a
-- alguien no alcance si ya nombró a un tercero.
--
-- Ahora `org_members` la escribe sólo `platform_admins`. La lectura no cambia:
-- el staff de la marca se sigue viendo entre sí.
drop policy if exists "org_members manage" on public.org_members;
create policy "org_members manage" on public.org_members
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Como superadmin de marca, esto debe funcionar:
--   insert into public.dojos (org_id, slug, name) values ('<su org>', 'nueva', 'Nueva Sede');
--
-- Y esto debe seguir fallando con 42501:
--   update public.dojos set billing = '{}'::jsonb where slug = 'lanus';
