-- ==============================================================================
-- LA LÓGICA DE COBRO LA ADMINISTRA SÓLO EL DESARROLLADOR
-- ==============================================================================
-- La UI ya lo cumplía: el editor de tramos vive en /superadmin, que es
-- exclusivo de `platform_admins`. Pero eso es una restricción de PANTALLA, no
-- de datos: un superadmin de marca tiene UPDATE sobre `dojos` (lo necesita para
-- editar nombre, dirección y branding de sus sedes), así que podía cambiar
-- `billing` pegándole directo a la API REST con su propio token:
--
--   curl -X PATCH '.../rest/v1/dojos?id=eq.<sede>' \
--        -H "Authorization: Bearer <su jwt>" \
--        -d '{"billing": {"tiers": [...sin recargo nunca...]}}'
--
-- RLS es por fila, no por columna, así que no alcanza con las policies. La
-- forma directa de restringir UNA columna es un trigger que compare el valor
-- viejo con el nuevo y rechace el cambio salvo que quien lo hace sea platform
-- admin.
--
-- Nota: el `service_role` (las API routes del servidor) tiene auth.uid() nulo,
-- así que `is_platform_admin()` da false. Por eso el trigger deja pasar
-- explícitamente a ese rol: esas rutas ya validan permisos por su cuenta con
-- `requirePlatformAdmin()`.
-- ==============================================================================

create or replace function public.enforce_billing_dev_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    -- Sin cambios en la columna, no hay nada que validar.
    if new.billing is not distinct from old.billing then
        return new;
    end if;

    -- El backend con service_role ya hizo su propio chequeo de permisos.
    if current_setting('request.jwt.claim.role', true) = 'service_role'
       or current_user = 'service_role' then
        return new;
    end if;

    if not public.is_platform_admin() then
        raise exception
            'La lógica de cobro sólo la administra el desarrollador de la plataforma'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

drop trigger if exists dojos_billing_dev_only on public.dojos;
create trigger dojos_billing_dev_only
    before update on public.dojos
    for each row
    execute function public.enforce_billing_dev_only();

comment on function public.enforce_billing_dev_only is
    'Restringe dojos.billing al platform admin. RLS es por fila; esto es por columna.';

-- ------------------------------------------------------------------------------
-- Verificación (correr como superadmin de marca, NO como dev)
-- ------------------------------------------------------------------------------
-- Debe fallar con 42501:
--   update public.dojos set billing = '{}'::jsonb where slug = 'lanus';
--
-- Debe funcionar (no toca billing):
--   update public.dojos set city = 'Lanús Oeste' where slug = 'lanus';
