-- ==============================================================================
-- ESCRITURAS QUE ESTABAN ABIERTAS AL INSTRUCTOR
-- ==============================================================================
-- Encontrado probando con tokens reales: un instructor pudo BORRAR las 4 clases
-- de su sede. No fue un 403 silencioso, se borraron.
--
-- Causa: las políticas de escritura de `classes`, `class_enrollments` y
-- `notifications` usan `can_read_dojo()` —que es el conjunto STAFF, o sea admin
-- + instructor— en lugar de `can_manage_dojo()`, que es sólo admin. El modelo
-- documentado dice que el instructor "ve alumnos y asistencia, no toca plata ni
-- config", y una clase es config.
--
-- `class_enrollments` importa además por otro motivo: la cuota estimada de cada
-- alumno (`estimated_monthly_fee`) se calcula a partir de sus inscripciones. Que
-- un instructor pueda inscribir o desinscribir es, en los hechos, poder cambiar
-- lo que se le cobra.
--
-- Segundo problema, el mismo que ya apareció en `payments`: estas políticas son
-- `for all`, y eso incluye SELECT. Como las permisivas se combinan con OR, la
-- política de lectura de al lado quedaba sin efecto. Se separan.
--
-- `qr_tokens` NO se toca: el instructor atiende la puerta y necesita generar el
-- código. Ahí `can_read_dojo` es lo correcto.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- classes
-- ------------------------------------------------------------------------------
drop policy if exists "classes manage" on public.classes;

create policy "classes insert" on public.classes
for insert to authenticated
with check (public.can_manage_dojo(dojo_id));

create policy "classes update" on public.classes
for update to authenticated
using (public.can_manage_dojo(dojo_id))
with check (public.can_manage_dojo(dojo_id));

create policy "classes delete" on public.classes
for delete to authenticated
using (public.can_manage_dojo(dojo_id));

-- ------------------------------------------------------------------------------
-- class_enrollments
-- ------------------------------------------------------------------------------
drop policy if exists "enrollments manage" on public.class_enrollments;

create policy "enrollments insert" on public.class_enrollments
for insert to authenticated
with check (public.can_manage_dojo(dojo_id));

create policy "enrollments update" on public.class_enrollments
for update to authenticated
using (public.can_manage_dojo(dojo_id))
with check (public.can_manage_dojo(dojo_id));

create policy "enrollments delete" on public.class_enrollments
for delete to authenticated
using (public.can_manage_dojo(dojo_id));

-- ------------------------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------------------------
drop policy if exists "notifications manage" on public.notifications;

create policy "notifications insert" on public.notifications
for insert to authenticated
with check (public.can_manage_dojo(dojo_id));

create policy "notifications update" on public.notifications
for update to authenticated
using (public.can_manage_dojo(dojo_id))
with check (public.can_manage_dojo(dojo_id));

create policy "notifications delete" on public.notifications
for delete to authenticated
using (public.can_manage_dojo(dojo_id));
