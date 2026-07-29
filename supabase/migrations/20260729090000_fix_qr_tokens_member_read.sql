-- ==============================================================================
-- FIX CRÍTICO — el alumno no podía validar el QR de su propia sede
-- ==============================================================================
-- La policy de `qr_tokens` era una sola, para todos los comandos:
--
--     using (dojo_id is null or can_read_dojo(dojo_id))
--
-- y `can_read_dojo()` incluye sólo al STAFF (admin, instructor) y al platform
-- admin. Los alumnos quedaban afuera.
--
-- El problema: `/validate` corre en el navegador DEL ALUMNO. Al escanear, busca
-- el token para comprobar que sea válido y no esté vencido:
--
--     supabase.from('qr_tokens').select('*').eq('dojo_id', …).eq('token', …)
--
-- Con la policy anterior esa consulta devolvía vacío SIEMPRE, y el alumno veía
-- "El código QR ha expirado o no es válido" aunque el código estuviera recién
-- generado. O sea: el flujo principal del producto no funcionaba para el único
-- rol que lo usa.
--
-- Se pasó de una policy única a dos, separando lectura de escritura:
--
--   SELECT → cualquier miembro activo de la sede. Necesario para validar, y no
--            expone nada: el token es justamente lo que el alumno acaba de
--            escanear de la pantalla o del cartel de la puerta.
--   WRITE  → sólo staff. Generar y rotar códigos sigue siendo del dojo.
-- ==============================================================================

drop policy if exists "qr_tokens staff" on public.qr_tokens;

-- Lectura: para validar el ingreso.
create policy "qr_tokens read" on public.qr_tokens
for select to authenticated
using (dojo_id is null or public.belongs_to_dojo(dojo_id));

-- Alta y rotación de códigos: staff de la sede.
create policy "qr_tokens manage" on public.qr_tokens
for all to authenticated
using (dojo_id is null or public.can_read_dojo(dojo_id))
with check (dojo_id is null or public.can_read_dojo(dojo_id));

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Logueado como alumno de una sede, esto debe devolver el token vigente:
--
--   select token from public.qr_tokens
--   where dojo_id = '<su sede>' and expires_at > now();
--
-- Y esto debe fallar (o afectar 0 filas):
--
--   insert into public.qr_tokens (dojo_id, token, expires_at)
--   values ('<su sede>', 'HACK', now() + interval '1 day');
