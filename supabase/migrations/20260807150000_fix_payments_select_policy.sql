-- ==============================================================================
-- SEPARAR LECTURA DE ESCRITURA EN `payments`
-- ==============================================================================
-- Bug encontrado probando los permisos por rol: al forzar `viewFinance = false`
-- para superadmin, la persona SEGUÍA viendo los pagos.
--
-- El motivo es que la política de escritura estaba declarada `for all`, y en
-- Postgres eso incluye SELECT. Las políticas permisivas se combinan con OR, así
-- que alcanzaba con pasar `can_manage_dojo()` para leer, y `can_read_finance()`
-- —la que consulta el permiso efectivo— nunca llegaba a decidir.
--
-- Consecuencia práctica: `viewFinance` sólo funcionaba para quien NO fuera
-- manager de la sede. Al head coach lo bloqueaba de casualidad, porque no lo es.
--
-- Se reemplaza la política `for all` por tres explícitas de escritura. La
-- lectura queda a cargo de una sola política, que es la que mira el permiso.
-- ==============================================================================

drop policy if exists "payments manage" on public.payments;

create policy "payments insert" on public.payments
for insert to authenticated
with check (public.can_manage_dojo(dojo_id));

create policy "payments update" on public.payments
for update to authenticated
using (public.can_manage_dojo(dojo_id))
with check (public.can_manage_dojo(dojo_id));

create policy "payments delete" on public.payments
for delete to authenticated
using (public.can_manage_dojo(dojo_id));

-- La lectura ya existe de la migración anterior y queda como única fuente:
--   using (user_id = auth.uid() or public.can_read_finance(dojo_id))
-- Se recrea por idempotencia, por si esta migración corre sola.
drop policy if exists "payments read" on public.payments;
create policy "payments read" on public.payments
for select to authenticated
using (user_id = auth.uid() or public.can_read_finance(dojo_id));
