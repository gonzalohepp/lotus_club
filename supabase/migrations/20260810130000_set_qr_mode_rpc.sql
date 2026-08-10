-- ==============================================================================
-- CAMBIAR EL MODO DEL QR: UN RPC ACOTADO A ESA COLUMNA
-- ==============================================================================
-- Bug encontrado al verificar la migración anterior: el interruptor de QR
-- fijo/rotativo NO funcionaba para nadie salvo el desarrollador, y lo hacía en
-- silencio.
--
-- Motivo: `20260728190000_dojos_manage_dev_only.sql` dejó sobre `dojos` una sola
-- política de escritura, `is_platform_admin()`. La pantalla hace
--
--     supabase.from('dojos').update({ qr_fixed: ... }).eq('id', dojoId)
--
-- y cuando RLS filtra todas las filas, PostgREST responde 204 sin error. El
-- código miraba `error`, veía null, daba el cambio por hecho y actualizaba el
-- estado local: el interruptor se movía en pantalla y la base seguía igual.
-- Recién al recargar volvía al valor viejo.
--
-- No se reabre el UPDATE sobre `dojos`: la ficha de la sede (nombre, dirección,
-- branding) es de la marca a propósito, y el administrador de la sucursal no la
-- edita. Lo único que le corresponde acá es esta decisión operativa, así que se
-- expone exactamente eso y nada más.
--
-- El trigger `enforce_qr_mode_sede_admin()` sigue puesto y vuelve a validar
-- dentro de la función: `security definer` saltea RLS, no saltea triggers.
-- ==============================================================================

create or replace function public.set_qr_mode(target uuid, fixed boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.can_manage_roster(target) then
        raise exception
            'El modo del QR lo cambia el administrador de la sede'
            using errcode = '42501';
    end if;

    update public.dojos
    set qr_fixed = fixed
    where id = target;

    -- Sin filas es una sede que no existe, no un problema de permisos.
    if not found then
        raise exception 'Sede inexistente' using errcode = 'P0002';
    end if;

    return fixed;
end;
$$;

revoke all on function public.set_qr_mode(uuid, boolean) from public;
grant execute on function public.set_qr_mode(uuid, boolean) to authenticated;

comment on function public.set_qr_mode is
    'Cambia dojos.qr_fixed. Único camino de escritura sobre esa columna para el admin de la sede.';

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Con el token de manager.demo-norte (admin de sede) debe devolver true:
--   select public.set_qr_mode('<sede-norte>', true);
--
-- Con el de brandadmin (Mestre) o headcoach debe fallar con 42501, y sobre una
-- sede que no es la suya el admin también:
--   select public.set_qr_mode('<sede-sur>', true);
