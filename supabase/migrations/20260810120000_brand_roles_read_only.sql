-- ==============================================================================
-- MESTRE Y COORDINADOR REGIONAL: LECTURA TOTAL, ESCRITURA CERO SOBRE LA SEDE
-- ==============================================================================
-- Modelo pedido: los roles de MARCA ven todas las sedes, todos los alumnos y
-- todas las clases, pero no dan de alta, no editan y no borran nada de eso.
-- Quien opera la academia es su administrador, que sí tiene fila propia en
-- `dojo_members`.
--
-- Por qué no alcanzaba con esconder los botones: `my_manager_dojo_ids()` mete
-- TODAS las sedes de las organizaciones donde uno es `superadmin`, y
-- `can_manage_dojo()` se apoya en esa lista. O sea que un Mestre pasaba el
-- predicado de escritura de `dojo_members`, `classes`, `class_enrollments` y
-- `memberships` en cada una de sus sucursales. Con su propio token:
--
--   curl -X DELETE '.../rest/v1/classes?id=eq.42' -H "Authorization: Bearer <jwt>"
--
-- El Coordinador regional (`head_coach`) ya no pasaba, porque
-- `my_owned_org_ids()` sólo cuenta `role = 'superadmin'`. Quedaba bien de
-- casualidad, no por diseño.
--
-- Se introduce un predicado propio en vez de tocar `can_manage_dojo()`, que
-- también gobierna pagos y configuración de la sede. Acotar el cambio a lo
-- pedido —alumnos, clases y el modo del QR— evita romper de rebote cosas que
-- nadie pidió revisar.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Quién es administrador REAL de una sede
-- ------------------------------------------------------------------------------
-- La diferencia con `my_manager_dojo_ids()` es una sola: acá no entra el rol
-- heredado de la marca. Hace falta la fila en `dojo_members`.
create or replace function public.my_sede_admin_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(dm.dojo_id), '{}'::uuid[])
    from public.dojo_members dm
    where dm.user_id = auth.uid()
      and dm.is_active
      and dm.role = 'admin';
$$;

comment on function public.my_sede_admin_dojo_ids is
    'Sedes donde la persona es admin por membresía propia. Excluye el rol heredado de la marca.';

-- Predicado de escritura sobre el padrón y las clases de una sede.
create or replace function public.can_manage_roster(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.is_platform_admin() or target = any (public.my_sede_admin_dojo_ids());
$$;

comment on function public.can_manage_roster is
    'Escritura de alumnos y clases: admin de la sede o desarrollador. Los roles de marca sólo leen.';

-- ------------------------------------------------------------------------------
-- 2. dojo_members — el padrón
-- ------------------------------------------------------------------------------
-- `for all` incluye SELECT, y las permisivas se combinan con OR: dejarla así
-- haría que la política de escritura decidiera también la lectura. Se separa,
-- igual que se hizo en `payments` y en `classes`.
drop policy if exists "dojo_members manage" on public.dojo_members;

create policy "dojo_members insert" on public.dojo_members
for insert to authenticated
with check (public.can_manage_roster(dojo_id));

create policy "dojo_members update" on public.dojo_members
for update to authenticated
using (public.can_manage_roster(dojo_id))
with check (public.can_manage_roster(dojo_id));

create policy "dojo_members delete" on public.dojo_members
for delete to authenticated
using (public.can_manage_roster(dojo_id));

-- La lectura no se toca: "dojo_members read own" ya dice
--   user_id = auth.uid() or can_read_dojo(dojo_id)
-- y `can_read_dojo` incluye a la marca. El Mestre sigue viendo el padrón entero.

-- ------------------------------------------------------------------------------
-- 3. classes / class_enrollments — las clases y sus inscripciones
-- ------------------------------------------------------------------------------
-- Ya estaban separadas por la migración 20260808120000 (que sacó al instructor
-- de la escritura). Acá sólo cambia el predicado: de `can_manage_dojo` —que
-- incluye a la marca— a `can_manage_roster`.
drop policy if exists "classes insert" on public.classes;
drop policy if exists "classes update" on public.classes;
drop policy if exists "classes delete" on public.classes;

create policy "classes insert" on public.classes
for insert to authenticated
with check (public.can_manage_roster(dojo_id));

create policy "classes update" on public.classes
for update to authenticated
using (public.can_manage_roster(dojo_id))
with check (public.can_manage_roster(dojo_id));

create policy "classes delete" on public.classes
for delete to authenticated
using (public.can_manage_roster(dojo_id));

drop policy if exists "enrollments insert" on public.class_enrollments;
drop policy if exists "enrollments update" on public.class_enrollments;
drop policy if exists "enrollments delete" on public.class_enrollments;

create policy "enrollments insert" on public.class_enrollments
for insert to authenticated
with check (public.can_manage_roster(dojo_id));

create policy "enrollments update" on public.class_enrollments
for update to authenticated
using (public.can_manage_roster(dojo_id))
with check (public.can_manage_roster(dojo_id));

create policy "enrollments delete" on public.class_enrollments
for delete to authenticated
using (public.can_manage_roster(dojo_id));

-- ------------------------------------------------------------------------------
-- 4. memberships — el vencimiento de cada alumno
-- ------------------------------------------------------------------------------
-- Es la fecha hasta la que el alumno tiene la cuota paga: renovarla es dar de
-- alta el mes. Va con el padrón.
drop policy if exists "memberships manage" on public.memberships;

create policy "memberships insert" on public.memberships
for insert to authenticated
with check (public.can_manage_roster(dojo_id));

create policy "memberships update" on public.memberships
for update to authenticated
using (public.can_manage_roster(dojo_id))
with check (public.can_manage_roster(dojo_id));

create policy "memberships delete" on public.memberships
for delete to authenticated
using (public.can_manage_roster(dojo_id));

-- "memberships read" (member_id = auth.uid() or can_read_dojo(dojo_id)) queda
-- como está: es la única que decide la lectura ahora que la de escritura dejó
-- de ser `for all`.

-- ------------------------------------------------------------------------------
-- 5. dojos.qr_fixed — el modo del código de la puerta
-- ------------------------------------------------------------------------------
-- Fijo (se imprime y se pega) o rotativo (se renueva solo) es una decisión de
-- quien atiende la puerta de esa sede, no de la marca. Cambiarlo invalida el
-- código que esté pegado, así que tampoco es reversible sin ir hasta el lugar.
--
-- RLS es por fila y la marca necesita UPDATE sobre `dojos` para editar nombre,
-- dirección y branding de sus sedes. Igual que con `billing`, la restricción de
-- UNA columna se hace con un trigger que compara viejo contra nuevo.
create or replace function public.enforce_qr_mode_sede_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    -- Sin cambios en la columna, no hay nada que validar.
    if new.qr_fixed is not distinct from old.qr_fixed then
        return new;
    end if;

    -- El backend con service_role ya hizo su propio chequeo de permisos.
    if current_setting('request.jwt.claim.role', true) = 'service_role'
       or current_user = 'service_role' then
        return new;
    end if;

    if not public.can_manage_roster(new.id) then
        raise exception
            'El modo del QR lo cambia el administrador de la sede'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

drop trigger if exists dojos_qr_mode_sede_admin on public.dojos;
create trigger dojos_qr_mode_sede_admin
    before update on public.dojos
    for each row
    execute function public.enforce_qr_mode_sede_admin();

comment on function public.enforce_qr_mode_sede_admin is
    'Restringe dojos.qr_fixed al admin de la sede. RLS es por fila; esto es por columna.';

-- ------------------------------------------------------------------------------
-- Verificación (con el token de brandadmin@test.local, que es Mestre)
-- ------------------------------------------------------------------------------
-- Deben devolver 0 filas afectadas o 42501:
--   delete from public.classes where dojo_id = '<sede>';
--   insert into public.dojo_members (dojo_id, user_id, role) values (...);
--   update public.dojos set qr_fixed = true where id = '<sede>';
--
-- Deben seguir funcionando (lectura):
--   select count(*) from public.classes where dojo_id = '<sede>';
--   select count(*) from public.dojo_members where dojo_id = '<sede>';
