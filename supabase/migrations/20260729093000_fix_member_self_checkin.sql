-- ==============================================================================
-- FIX CRÍTICO — el alumno no podía registrar su propio ingreso ni asistencia
-- ==============================================================================
-- Segunda y tercera pieza del mismo problema que `qr_tokens`: las policies de
-- `access_logs` y `class_attendance` daban INSERT sólo a `can_read_dojo()`, es
-- decir al staff.
--
-- Pero `/validate` —la pantalla que valida el QR— corre en el navegador DEL
-- ALUMNO, y al confirmar la clase hace exactamente estas dos escrituras:
--
--     insert into class_attendance (dojo_id, user_id, class_id, date)
--     insert into access_logs      (dojo_id, user_id, result, reason)
--
-- Con las policies anteriores las dos devolvían 403. El alumno escaneaba, veía
-- el popup, tildaba la clase… y no quedaba registrado nada: ni su asistencia ni
-- su ingreso. La pantalla no mostraba error porque el código ignora el resultado
-- de esos inserts.
--
-- Ahora cada rol puede escribir lo que le corresponde:
--   · El alumno, SÓLO SUS PROPIAS filas y sólo en sedes a las que pertenece.
--   · El staff, cualquier fila de su sede (alta manual, acceso de invitado).
--
-- ⚠️ NOTA DE DISEÑO, no resuelta acá: la decisión de "acceso autorizado" se toma
-- en el cliente. Un alumno con conocimientos podría insertar un log
-- 'autorizado' sin escanear nada. Cerrar eso requiere mover la validación a una
-- API route que verifique el token y el estado de cuota en el servidor, y
-- quitarle el INSERT directo al alumno. Ver §"Pendientes" del reporte de tests.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- access_logs
-- ------------------------------------------------------------------------------
drop policy if exists "access_logs insert" on public.access_logs;

-- El alumno registra su propio ingreso al escanear.
create policy "access_logs insert self" on public.access_logs
for insert to authenticated
with check (
    user_id = auth.uid()
    and public.belongs_to_dojo(dojo_id)
);

-- El staff registra cualquier ingreso de su sede, incluido el de invitados
-- (donde `user_id` va nulo).
create policy "access_logs insert staff" on public.access_logs
for insert to authenticated
with check (public.can_read_dojo(dojo_id));

-- ------------------------------------------------------------------------------
-- class_attendance
-- ------------------------------------------------------------------------------
do $$
begin
    if to_regclass('public.class_attendance') is null then
        return;
    end if;

    execute 'drop policy if exists "attendance manage" on public.class_attendance';

    -- El alumno se da el presente a sí mismo.
    execute $p$
        create policy "attendance insert self" on public.class_attendance
        for insert to authenticated
        with check (
            user_id = auth.uid()
            and public.belongs_to_dojo(dojo_id)
        )
    $p$;

    -- Ve su propio historial; el staff ve el de toda la sede.
    execute $p$
        create policy "attendance read" on public.class_attendance
        for select to authenticated
        using (user_id = auth.uid() or public.can_read_dojo(dojo_id))
    $p$;

    -- Corregir o borrar asistencias queda en manos del staff.
    execute $p$
        create policy "attendance manage staff" on public.class_attendance
        for all to authenticated
        using (public.can_read_dojo(dojo_id))
        with check (public.can_read_dojo(dojo_id))
    $p$;
end $$;

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Como alumno de una sede, esto debe funcionar:
--   insert into access_logs (dojo_id, user_id, result) values ('<su sede>', auth.uid(), 'autorizado');
--
-- Y esto debe fallar (registrarle el ingreso a otra persona):
--   insert into access_logs (dojo_id, user_id, result) values ('<su sede>', '<otro uuid>', 'autorizado');
