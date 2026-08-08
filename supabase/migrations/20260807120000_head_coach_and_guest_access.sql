-- ==============================================================================
-- HEAD COACH + ACCESO DE INVITADOS
-- ==============================================================================
-- Dos cambios pedidos:
--
-- 1. Nuevo rol de marca `head_coach`: ve TODAS las sedes y TODOS los alumnos de
--    su organización, pero NO ve nada de finanzas. Hasta ahora el único rol de
--    marca con alcance total era `superadmin`, que sí ve plata.
--
-- 2. El acceso de invitado deja de ser un registro anónimo: pasa a distinguir
--    entre alumno de prueba (primera clase gratis) y visita de otra sede de la
--    misma marca, y guarda quién autorizó.
--
-- Jerarquía resultante:
--
--   desarrollador   platform_admins                todo + /superadmin
--   head coach      org_members 'head_coach'       todas las sedes, SIN finanzas
--   superadmin      org_members 'superadmin'       todas las sedes, CON finanzas
--   academy manager dojo_members 'admin'           su sede, todo incl. finanzas
--   instructor      dojo_members 'instructor'      su sede, alumnos y asistencia
--   alumno          dojo_members 'member'          sólo lo propio
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. El rol
-- ------------------------------------------------------------------------------
-- Postgres no permite ADD VALUE dentro de un bloque transaccional junto con su
-- uso posterior, así que va suelto y con guarda de existencia.
do $$
begin
    if not exists (
        select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = 'org_role' and e.enumlabel = 'head_coach'
    ) then
        alter type public.org_role add value 'head_coach';
    end if;
end $$;

comment on type public.org_role is
    'Roles a nivel marca: superadmin (todo, incluida plata), head_coach (todas '
    'las sedes y alumnos, SIN finanzas), manager (legado).';

-- ------------------------------------------------------------------------------
-- 2. Finanzas: un predicado propio
-- ------------------------------------------------------------------------------
-- Antes `payments` se leía con `can_read_dojo`, o sea cualquier staff de la sede
-- — incluido el instructor, que no debe ver plata, y ahora el head coach. La
-- lectura de plata pasa a su propio conjunto: superadmin de la marca o admin de
-- la sede.
create or replace function public.my_finance_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(distinct d.id), '{}'::uuid[])
    from public.dojos d
    where d.org_id = any (public.my_owned_org_ids())
       or exists (
            select 1 from public.dojo_members dm
            where dm.dojo_id = d.id
              and dm.user_id = auth.uid()
              and dm.is_active
              and dm.role = 'admin'
       );
$$;

comment on function public.my_finance_dojo_ids() is
    'Sedes donde el usuario puede VER plata: superadmin de la marca o admin de '
    'la sede. Excluye head_coach e instructor a propósito.';

create or replace function public.can_read_finance(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.is_platform_admin() or target = any (public.my_finance_dojo_ids());
$$;

drop policy if exists "payments read" on public.payments;
create policy "payments read" on public.payments
for select to authenticated
using (user_id = auth.uid() or public.can_read_finance(dojo_id));

-- ------------------------------------------------------------------------------
-- 3. Acceso de invitado: qué se guarda
-- ------------------------------------------------------------------------------
-- El registro anterior era `user_id = null, reason = 'Acceso invitado manual'`:
-- no quedaba quién entró ni quién lo dejó entrar.
alter table public.access_logs
    add column if not exists guest_kind text
        check (guest_kind is null or guest_kind in ('trial', 'visitor')),
    add column if not exists guest_name text,
    add column if not exists guest_origin_dojo_id uuid references public.dojos(id) on delete set null,
    add column if not exists guest_member_id uuid references public.profiles(user_id) on delete set null,
    add column if not exists authorized_by uuid references public.profiles(user_id) on delete set null;

comment on column public.access_logs.guest_kind is
    'trial = primera clase gratis de prueba; visitor = alumno de otra sede de la marca.';
comment on column public.access_logs.authorized_by is
    'Quién habilitó el ingreso. Sin esto no hay a quién preguntarle por un acceso manual.';

-- ------------------------------------------------------------------------------
-- 4. Elegir al visitante entre los alumnos de otra sede
-- ------------------------------------------------------------------------------
-- El selector necesita leer alumnos de una sede que NO es la propia, y la RLS
-- aísla por sede a propósito. En vez de abrir esa política, va una función
-- acotada: devuelve SÓLO id y nombre, SÓLO de sedes de la MISMA organización, y
-- SÓLO si quien pregunta es staff de alguna sede de esa organización.
create or replace function public.org_visitable_members(target_dojo uuid)
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select p.user_id,
           trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as full_name
    from public.dojo_members dm
    join public.profiles p on p.user_id = dm.user_id
    where dm.dojo_id = target_dojo
      and dm.is_active
      and dm.role in ('member', 'becado')
      -- quien pregunta tiene que ser staff de una sede de la MISMA organización
      and exists (
          select 1
          from public.dojos d_target
          join public.dojos d_mine on d_mine.org_id = d_target.org_id
          where d_target.id = target_dojo
            and d_mine.id = any (public.my_staff_dojo_ids())
      )
    order by full_name;
$$;

revoke all on function public.org_visitable_members(uuid) from public, anon;
grant execute on function public.org_visitable_members(uuid) to authenticated;

comment on function public.org_visitable_members(uuid) is
    'Alumnos de otra sede de la MISMA marca, sólo id y nombre, para el selector '
    'de visitas. No expone email, teléfono ni estado de cuota.';

-- ------------------------------------------------------------------------------
-- 5. Sedes elegibles como origen de una visita
-- ------------------------------------------------------------------------------
-- Un instructor sólo "ve" su propia sede, pero el visitante puede venir de
-- cualquier filial de la marca. Devuelve nombre e id de las sedes activas de las
-- organizaciones donde quien pregunta es staff.
create or replace function public.org_visitable_dojos()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select d.id, d.name
    from public.dojos d
    where d.is_active
      and d.org_id in (
          select d_mine.org_id
          from public.dojos d_mine
          where d_mine.id = any (public.my_staff_dojo_ids())
      )
    order by d.name;
$$;

revoke all on function public.org_visitable_dojos() from public, anon;
grant execute on function public.org_visitable_dojos() to authenticated;

comment on function public.org_visitable_dojos() is
    'Sedes de la marca para el selector de visitas. Sólo id y nombre.';
