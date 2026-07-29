-- ==============================================================================
-- LA VALIDACIÓN DE ACCESO PASA AL SERVIDOR
-- ==============================================================================
-- Hasta ahora la decisión de "acceso autorizado" se tomaba en el navegador del
-- alumno, que después insertaba el registro él mismo. Las policies de
-- 20260729093000 arreglaron que el flujo FUNCIONARA, pero dejaron abierto que
-- alguien con la consola del navegador hiciera:
--
--     await supabase.from('access_logs').insert({
--       dojo_id: '<su sede>', user_id: '<el suyo>', result: 'autorizado'
--     })
--
-- ...sin escanear nada y con la cuota vencida. El daño estaba acotado (sólo
-- podía hacerlo para sí mismo y en su sede) pero el control de acceso quedaba
-- en manos del controlado.
--
-- Ahora la única vía es `/api/access/validate` + `/api/access/checkin`, que
-- verifican token, sede, estado de cuota, cooldown e inscripción en el servidor
-- y escriben con service role. Este archivo le saca al alumno el INSERT directo.
--
-- El staff CONSERVA el insert directo: lo necesita para el acceso de invitados
-- y las altas manuales desde /qr, y ahí la persona que opera es de confianza.
-- ==============================================================================

drop policy if exists "access_logs insert self" on public.access_logs;

do $$
begin
    if to_regclass('public.class_attendance') is not null then
        execute 'drop policy if exists "attendance insert self" on public.class_attendance';
    end if;
end $$;

-- Quedan vigentes:
--   access_logs      "access_logs read"          select  propio o staff
--   access_logs      "access_logs insert staff"  insert  can_read_dojo
--   class_attendance "attendance read"           select  propio o staff
--   class_attendance "attendance manage staff"   all     can_read_dojo

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Como alumno, esto debe fallar con 403:
--   insert into access_logs (dojo_id, user_id, result)
--   values ('<su sede>', auth.uid(), 'autorizado');
--
-- Y el ingreso por la app debe seguir funcionando, porque pasa por la API route.
