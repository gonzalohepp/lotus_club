-- ==============================================================================
-- RLS MULTI-TENANT — aislamiento real entre dojos
-- ==============================================================================
-- Garantiza a nivel de base de datos (no de aplicación) que:
--   * Un admin de Lotus Lanús no puede leer NI escribir nada de Avellaneda,
--     ni siquiera pegándole directo a la API REST con el anon key.
--   * Un alumno sólo ve sus propios datos, en cada dojo donde esté activo.
--   * Un platform admin ve todo.
--
-- Patrón usado en todas las tablas de datos:
--   SELECT  → dueño del dato  OR  can_read_dojo(dojo_id)
--   WRITE   → can_read_dojo(dojo_id) para operativa (staff, incluye instructor)
--             can_manage_dojo(dojo_id) para plata y configuración (owner/admin)
--
-- ⚠️ POR QUÉ SE BORRAN *TODAS* LAS POLÍTICAS ANTES DE CREAR LAS NUEVAS
--
-- Las políticas RLS de una tabla se combinan con OR. Alcanza con que sobreviva
-- UNA política vieja del tipo `USING (true)` para que todo el aislamiento por
-- dojo quede anulado: el motor evalúa "¿es mío? ¿o es de mi dojo? ¿o true?" y
-- devuelve todo.
--
-- La base heredada tiene políticas creadas a mano desde el Studio con nombres
-- que no están en ninguna migración (por ejemplo
-- "member_grades select authenticated" con USING (true), y "Admins and
-- instructors can manage grades" que mira el rol GLOBAL de profiles). Dropear
-- por nombre adivinado deja esas puertas abiertas sin que nada falle.
--
-- Por eso `drop_all_policies()` limpia por catálogo (pg_policy) en vez de por
-- nombre. Es la única forma de garantizar que después de esta migración las
-- ÚNICAS políticas vigentes sean las de acá abajo.
--
-- Recordatorio: estas políticas definen el MÁXIMO visible. El filtro por dojo
-- activo lo hace la app con `.eq('dojo_id', activeDojoId)`.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Helper: limpiar por catálogo, no por nombre
-- ------------------------------------------------------------------------------
create or replace function public.drop_all_policies(tbl regclass)
returns void
language plpgsql
as $$
declare
    pol record;
begin
    for pol in select polname from pg_policy where polrelid = tbl loop
        execute format('drop policy %I on %s', pol.polname, tbl::text);
    end loop;
end;
$$;

-- ------------------------------------------------------------------------------
-- 1. Tablas de tenant
-- ------------------------------------------------------------------------------
alter table public.organizations   enable row level security;
alter table public.dojos           enable row level security;
alter table public.dojo_members    enable row level security;
alter table public.platform_admins enable row level security;

-- ORGANIZATIONS ----------------------------------------------------------------
select public.drop_all_policies('public.organizations');

create policy "orgs read own" on public.organizations
for select to authenticated
using (
    public.is_platform_admin()
    or exists (
        select 1 from public.dojos d
        where d.org_id = organizations.id
          and d.id = any (public.my_dojo_ids())
    )
);

-- Alta/baja de organizaciones = sólo el dueño de la plataforma (vos).
create policy "orgs manage platform" on public.organizations
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- DOJOS ------------------------------------------------------------------------
select public.drop_all_policies('public.dojos');

create policy "dojos read own" on public.dojos
for select to authenticated
using (public.belongs_to_dojo(id));

-- La landing pública necesita listar sedes activas para el mapa.
create policy "dojos public map" on public.dojos
for select to anon
using (is_active);

-- El dueño del dojo edita SU dojo (incluida la lógica de cobro). No puede
-- moverlo de organización ni crear dojos nuevos: eso es del platform admin.
create policy "dojos update own" on public.dojos
for update to authenticated
using (public.can_manage_dojo(id))
with check (public.can_manage_dojo(id));

create policy "dojos manage platform" on public.dojos
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- DOJO_MEMBERS -----------------------------------------------------------------
select public.drop_all_policies('public.dojo_members');

create policy "dojo_members read own" on public.dojo_members
for select to authenticated
using (
    user_id = auth.uid()                 -- mis propias pertenencias (arma el switcher)
    or public.can_read_dojo(dojo_id)     -- el staff ve el padrón de su dojo
);

create policy "dojo_members manage" on public.dojo_members
for all to authenticated
using (public.can_manage_dojo(dojo_id))
with check (public.can_manage_dojo(dojo_id));

-- PLATFORM_ADMINS --------------------------------------------------------------
-- Se lee sólo a sí mismo; el alta se hace con service_role (o SQL directo).
select public.drop_all_policies('public.platform_admins');

create policy "platform_admins self" on public.platform_admins
for select to authenticated
using (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 2. PROFILES — global, pero visible sólo a quien comparte dojo
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
select public.drop_all_policies('public.profiles');

create policy "profiles read self or staff" on public.profiles
for select to authenticated
using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or exists (
        select 1 from public.dojo_members dm
        where dm.user_id = profiles.user_id
          and dm.dojo_id = any (public.my_staff_dojo_ids())
    )
);

create policy "profiles update self" on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "profiles manage staff" on public.profiles
for all to authenticated
using (
    public.is_platform_admin()
    or exists (
        select 1 from public.dojo_members dm
        where dm.user_id = profiles.user_id
          and dm.dojo_id = any (public.my_manager_dojo_ids())
    )
)
with check (
    public.is_platform_admin()
    or exists (
        select 1 from public.dojo_members dm
        where dm.user_id = profiles.user_id
          and dm.dojo_id = any (public.my_manager_dojo_ids())
    )
);

-- ------------------------------------------------------------------------------
-- 3. Tablas de datos scopeadas por dojo_id
-- ------------------------------------------------------------------------------
-- OJO con los nombres de columna: NO son uniformes en el schema heredado.
--   memberships   → member_id
--   member_grades → user_id
--   el resto      → user_id
-- Un search & replace ciego entre ambos rompe la migración con
-- "column ... does not exist".

-- CLASSES ----------------------------------------------------------------------
alter table public.classes enable row level security;
select public.drop_all_policies('public.classes');

create policy "classes read" on public.classes
for select to authenticated
using (public.belongs_to_dojo(dojo_id));

-- La grilla de horarios de la landing es pública.
create policy "classes public" on public.classes
for select to anon
using (exists (select 1 from public.dojos d where d.id = classes.dojo_id and d.is_active));

create policy "classes manage" on public.classes
for all to authenticated
using (public.can_read_dojo(dojo_id))
with check (public.can_read_dojo(dojo_id));

-- CLASS_ENROLLMENTS ------------------------------------------------------------
alter table public.class_enrollments enable row level security;
select public.drop_all_policies('public.class_enrollments');

create policy "enrollments read" on public.class_enrollments
for select to authenticated
using (user_id = auth.uid() or public.can_read_dojo(dojo_id));

create policy "enrollments manage" on public.class_enrollments
for all to authenticated
using (public.can_read_dojo(dojo_id))
with check (public.can_read_dojo(dojo_id));

-- MEMBERSHIPS ------------------------------------------------------------------
alter table public.memberships enable row level security;
select public.drop_all_policies('public.memberships');

create policy "memberships read" on public.memberships
for select to authenticated
using (member_id = auth.uid() or public.can_read_dojo(dojo_id));

-- Las membresías son plata: sólo owner/admin.
create policy "memberships manage" on public.memberships
for all to authenticated
using (public.can_manage_dojo(dojo_id))
with check (public.can_manage_dojo(dojo_id));

-- PAYMENTS ---------------------------------------------------------------------
alter table public.payments enable row level security;
select public.drop_all_policies('public.payments');

create policy "payments read" on public.payments
for select to authenticated
using (user_id = auth.uid() or public.can_read_dojo(dojo_id));

create policy "payments manage" on public.payments
for all to authenticated
using (public.can_manage_dojo(dojo_id))
with check (public.can_manage_dojo(dojo_id));

-- ACCESS_LOGS ------------------------------------------------------------------
alter table public.access_logs enable row level security;
select public.drop_all_policies('public.access_logs');

create policy "access_logs read" on public.access_logs
for select to authenticated
using (user_id = auth.uid() or public.can_read_dojo(dojo_id));

-- El scanner corre como staff del dojo donde escanea.
create policy "access_logs insert" on public.access_logs
for insert to authenticated
with check (public.can_read_dojo(dojo_id));

-- QR_TOKENS --------------------------------------------------------------------
alter table public.qr_tokens enable row level security;
select public.drop_all_policies('public.qr_tokens');

create policy "qr_tokens staff" on public.qr_tokens
for all to authenticated
using (dojo_id is null or public.can_read_dojo(dojo_id))
with check (dojo_id is null or public.can_read_dojo(dojo_id));

-- NOTIFICATIONS ----------------------------------------------------------------
alter table public.notifications enable row level security;
select public.drop_all_policies('public.notifications');

create policy "notifications read own" on public.notifications
for select to authenticated
using (user_id = auth.uid() or public.can_read_dojo(dojo_id));

create policy "notifications manage" on public.notifications
for all to authenticated
using (public.can_read_dojo(dojo_id))
with check (public.can_read_dojo(dojo_id));

-- PUSH_SUBSCRIPTIONS -----------------------------------------------------------
-- Queda GLOBAL a propósito: es la suscripción del navegador de una persona, no
-- un dato del dojo. El filtrado de a quién se le manda push se hace al armar el
-- envío (por dojo_id de la audiencia), no acá.
alter table public.push_subscriptions enable row level security;
select public.drop_all_policies('public.push_subscriptions');

create policy "push own" on public.push_subscriptions
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 4. Tablas opcionales (pueden no existir según hasta qué migración llegó)
-- ------------------------------------------------------------------------------
do $$
begin
    if to_regclass('public.notification_settings') is not null then
        execute 'alter table public.notification_settings enable row level security';
        perform public.drop_all_policies('public.notification_settings');
        execute $p$
            create policy "notif_settings manage" on public.notification_settings
            for all to authenticated
            using (dojo_id is null or public.can_manage_dojo(dojo_id))
            with check (dojo_id is null or public.can_manage_dojo(dojo_id))
        $p$;
    end if;

    if to_regclass('public.notification_history') is not null then
        execute 'alter table public.notification_history enable row level security';
        perform public.drop_all_policies('public.notification_history');
        execute $p$
            create policy "notif_history staff" on public.notification_history
            for all to authenticated
            using (dojo_id is null or public.can_read_dojo(dojo_id))
            with check (dojo_id is null or public.can_read_dojo(dojo_id))
        $p$;
    end if;

    -- Graduaciones. La columna de la persona acá es `user_id` (no `member_id`),
    -- y esta tabla arrastraba dos políticas abiertas del Studio:
    --   "member_grades select authenticated"  USING (true)
    --   "Admins and instructors can manage grades"  (rol global de profiles)
    -- drop_all_policies() las elimina sin necesidad de nombrarlas.
    if to_regclass('public.member_grades') is not null then
        execute 'alter table public.member_grades enable row level security';
        perform public.drop_all_policies('public.member_grades');
        execute $p$
            create policy "grades read" on public.member_grades
            for select to authenticated
            using (user_id = auth.uid() or public.can_read_dojo(dojo_id))
        $p$;
        execute $p$
            create policy "grades manage" on public.member_grades
            for all to authenticated
            using (public.can_read_dojo(dojo_id))
            with check (public.can_read_dojo(dojo_id))
        $p$;
    end if;

    if to_regclass('public.class_attendance') is not null then
        execute 'alter table public.class_attendance enable row level security';
        perform public.drop_all_policies('public.class_attendance');
        execute $p$
            create policy "attendance manage" on public.class_attendance
            for all to authenticated
            using (public.can_read_dojo(dojo_id))
            with check (public.can_read_dojo(dojo_id))
        $p$;
    end if;

    -- Tablas heredadas que siguen existiendo pero ya no son la fuente de verdad.
    -- `academies` quedó reemplazada por `dojos`; se le deja lectura pública para
    -- que el mapa de la landing no se rompa mientras se migra ese componente.
    if to_regclass('public.academies') is not null then
        execute 'alter table public.academies enable row level security';
        perform public.drop_all_policies('public.academies');
        execute $p$
            create policy "academies public read" on public.academies
            for select to anon, authenticated
            using (true)
        $p$;
        execute $p$
            create policy "academies manage platform" on public.academies
            for all to authenticated
            using (public.is_platform_admin())
            with check (public.is_platform_admin())
        $p$;
    end if;

    if to_regclass('public.landing_events') is not null then
        execute 'alter table public.landing_events enable row level security';
        perform public.drop_all_policies('public.landing_events');
        -- La landing escribe analítica sin sesión; leerla es sólo para la plataforma.
        execute $p$
            create policy "landing_events insert" on public.landing_events
            for insert to anon, authenticated
            with check (true)
        $p$;
        execute $p$
            create policy "landing_events read platform" on public.landing_events
            for select to authenticated
            using (public.is_platform_admin())
        $p$;
    end if;
end $$;

-- ------------------------------------------------------------------------------
-- 5. Limpieza
-- ------------------------------------------------------------------------------
-- El helper no debe quedar disponible: dropear políticas exige ser owner de la
-- tabla, así que un `authenticated` no podría usarlo, pero no hay razón para
-- dejarlo expuesto en el schema public.
drop function if exists public.drop_all_policies(regclass);

-- ------------------------------------------------------------------------------
-- 6. Verificación (correr a mano después de aplicar)
-- ------------------------------------------------------------------------------
-- a) Tablas de public SIN RLS — debería devolver 0 filas:
--
--   select c.relname
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
--   order by 1;
--
-- b) Políticas que dejan pasar todo — revisá que sólo aparezcan las que
--    esperás (academies/landing_events públicas, classes/dojos para el mapa):
--
--   select c.relname, p.polname, pg_get_expr(p.polqual, p.polrelid) as using_expr
--   from pg_policy p join pg_class c on c.oid = p.polrelid
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public'
--     and pg_get_expr(p.polqual, p.polrelid) = 'true'
--   order by 1, 2;
