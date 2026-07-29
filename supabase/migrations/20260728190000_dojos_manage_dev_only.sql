-- ==============================================================================
-- EL ALTA DE SEDES VUELVE A SER DEL DESARROLLADOR
-- ==============================================================================
-- Decisión de producto: por ahora el superadmin de una marca VE sus academias
-- pero no las crea ni las edita. Si necesita una sede nueva, la pide al dev.
--
-- Esto revierte 20260728170000 en lo que hace a `dojos`. El resto de esa
-- migración (la escritura de `org_members` restringida al platform admin) se
-- mantiene.
--
-- Por qué el ida y vuelta quedó barato: el trigger `enforce_billing_dev_only()`
-- protege `dojos.billing` a nivel de COLUMNA, así que abrir o cerrar el UPDATE
-- sobre la tabla no afecta la lógica de cobro en ningún caso.
-- ==============================================================================

drop policy if exists "dojos manage org" on public.dojos;

-- Vigentes sobre `dojos` después de esto:
--   "dojos read own"        select  belongs_to_dojo(id)   → incluye superadmin de marca
--   "dojos public map"      select  is_active, anon       → mapa de la landing
--   "dojos manage platform" all     is_platform_admin()   → el desarrollador

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
--   select polname, polcmd from pg_policy
--   where polrelid = 'public.dojos'::regclass order by 1;
