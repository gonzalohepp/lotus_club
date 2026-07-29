-- ==============================================================================
-- RESET DE DATOS — dejar staging limpio, conservando el schema
-- ==============================================================================
-- ⚠️ DESTRUCTIVO. Borra TODOS los datos de negocio. Corré esto sólo en el
-- proyecto de staging (lotus-test), nunca en producción de Beleza.
--
-- Contexto: el restore trajo el schema `public` de Beleza pero no el schema
-- `auth`, así que quedaron perfiles de alumnos sin usuario que pueda loguearse,
-- y el backfill de `dojo_members` insertó 0 filas porque filtra por auth.users.
-- Esos datos no sirven para probar multi-tenant y ensucian las pruebas.
--
-- Qué NO toca:
--   * El schema (tablas, vistas, funciones, políticas RLS): queda todo.
--   * auth.users: ya está vacía. Los usuarios los vas a crear desde la app.
--
-- Antes de correrlo, mirá qué te vas a llevar puesto (paso 1).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Qué hay ahora (ejecutá esto primero, solo)
-- ------------------------------------------------------------------------------
select
    (select count(*) from auth.users)              as usuarios_auth,
    (select count(*) from public.profiles)         as perfiles,
    (select count(*) from public.dojo_members)     as pertenencias,
    (select count(*) from public.classes)          as clases,
    (select count(*) from public.payments)         as pagos,
    (select count(*) from public.memberships)      as membresias,
    (select count(*) from public.organizations)    as organizaciones,
    (select count(*) from public.dojos)            as dojos;

-- ------------------------------------------------------------------------------
-- 2. El borrado
-- ------------------------------------------------------------------------------
-- TRUNCATE en un solo statement resuelve las dependencias entre las tablas
-- listadas sin pelearse con el orden de las foreign keys. RESTART IDENTITY
-- resetea los contadores (ids de classes, payments, access_logs) para que
-- staging arranque desde 1.
--
-- Las tablas opcionales van en un bloque aparte porque pueden no existir según
-- hasta qué migración llegó esta instancia.

begin;

truncate table
    public.class_enrollments,
    public.payments,
    public.memberships,
    public.access_logs,
    public.notifications,
    public.qr_tokens,
    public.classes,
    public.dojo_members,
    public.profiles,
    public.academies,
    public.dojos,
    public.organizations
restart identity cascade;

do $$
begin
    if to_regclass('public.member_grades') is not null then
        execute 'truncate table public.member_grades restart identity cascade';
    end if;
    if to_regclass('public.class_attendance') is not null then
        execute 'truncate table public.class_attendance restart identity cascade';
    end if;
    if to_regclass('public.notification_history') is not null then
        execute 'truncate table public.notification_history restart identity cascade';
    end if;
    if to_regclass('public.notification_settings') is not null then
        execute 'truncate table public.notification_settings restart identity cascade';
    end if;
    if to_regclass('public.landing_events') is not null then
        execute 'truncate table public.landing_events restart identity cascade';
    end if;
    if to_regclass('public.push_subscriptions') is not null then
        execute 'truncate table public.push_subscriptions restart identity cascade';
    end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. Semilla mínima: una organización con una sede
-- ------------------------------------------------------------------------------
-- Hace falta al menos un dojo para que el panel tenga dónde pararse. El resto
-- (nombre, colores, plan, reglas de cobro, sedes adicionales) lo configurás
-- desde /superadmin sin volver a tocar SQL.
insert into public.organizations (slug, name, plan)
values ('lotus', 'Lotus Club', 'pro');

insert into public.dojos (org_id, slug, name, city)
select id, 'lanus', 'Lotus Lanús', 'Lanús'
from public.organizations where slug = 'lotus';

commit;

-- ------------------------------------------------------------------------------
-- 4. Cómo quedó
-- ------------------------------------------------------------------------------
select o.name as organizacion, o.plan, d.name as sede, d.slug, d.billing->'tiers' as tramos_cobro
from public.dojos d
join public.organizations o on o.id = d.org_id
order by o.name, d.name;
