-- ==============================================================================
-- COBRAR ES DE LA SEDE, NO DE LA MARCA
-- ==============================================================================
-- Completa el modelo de 20260810120000: ahí los roles de marca quedaron en sólo
-- lectura sobre alumnos, clases y el modo del QR, pero `payments` no se tocó
-- porque no estaba en el pedido. Ahora sí: ni el Mestre ni el Coordinador
-- regional registran pagos.
--
-- Estado que se corrige: las políticas de escritura de `payments` usan
-- `can_manage_dojo()`, que incluye todas las sedes de las organizaciones donde
-- uno es superadmin. O sea que el Mestre podía cargar, editar y borrar pagos de
-- cualquier sucursal con su propio token. Al Coordinador ya lo frenaba
-- `can_read_finance()`, pero por el lado de la lectura, no de la escritura.
--
-- VER plata y COBRAR quedan como dos cosas distintas, que es lo que son: el
-- Mestre necesita la recaudación de toda la marca para dirigir, y no por eso
-- está en el mostrador de una academia.
-- ==============================================================================

create or replace function public.can_manage_payments(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    -- Administrador con fila propia en la sede (no el rol heredado de la marca)
    -- Y con acceso a finanzas, que respeta el override de la consola: si se le
    -- quita "ver finanzas" al rol admin, tampoco puede cobrar.
    select public.is_platform_admin()
        or (
            target = any (public.my_sede_admin_dojo_ids())
            and public.can_read_finance(target)
        );
$$;

comment on function public.can_manage_payments is
    'Escritura de pagos: admin con membresía propia en la sede y con acceso a finanzas.';

drop policy if exists "payments insert" on public.payments;
drop policy if exists "payments update" on public.payments;
drop policy if exists "payments delete" on public.payments;

create policy "payments insert" on public.payments
for insert to authenticated
with check (public.can_manage_payments(dojo_id));

create policy "payments update" on public.payments
for update to authenticated
using (public.can_manage_payments(dojo_id))
with check (public.can_manage_payments(dojo_id));

create policy "payments delete" on public.payments
for delete to authenticated
using (public.can_manage_payments(dojo_id));

-- La lectura no se toca: "payments read" sigue siendo
--   user_id = auth.uid() or can_read_finance(dojo_id)
-- así que el Mestre sigue viendo toda la recaudación y el Coordinador ninguna.

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
-- Con el token de brandadmin (Mestre): lee pagos, no los escribe.
--   select count(*) from public.payments where dojo_id = '<sede>';   → cuenta
--   update public.payments set amount = amount where dojo_id = '<sede>'; → 0 filas
--
-- Con el de manager.demo-norte (admin de esa sede): las dos cosas.
