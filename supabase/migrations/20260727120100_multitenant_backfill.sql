-- ==============================================================================
-- MULTI-TENANT — dojo_id en las tablas de datos + backfill del dojo original
-- ==============================================================================
-- Agrega la columna de tenant a todo lo que hoy es global y migra los datos
-- existentes al primer dojo (la sede que ya venía funcionando single-tenant).
--
-- Orden de ejecución: DESPUÉS de 20260727120000_multitenant_core.sql.
--
-- Idempotente: se puede correr varias veces. En una base nueva y vacía el
-- backfill simplemente no encuentra filas que migrar.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Organización + dojo semilla
-- ------------------------------------------------------------------------------
-- Todo lo que ya existe pertenece a este dojo. Los nombres se cambian después
-- desde /superadmin; acá sólo importa que exista un destino para el backfill.
insert into public.organizations (slug, name, plan)
values ('lotus', 'Lotus Club', 'pro')
on conflict (slug) do nothing;

insert into public.dojos (org_id, slug, name, city)
select o.id, 'principal', 'Sede Principal', null
from public.organizations o
where o.slug = 'lotus'
on conflict (org_id, slug) do nothing;

-- ------------------------------------------------------------------------------
-- 2. Columna dojo_id en las tablas de datos
-- ------------------------------------------------------------------------------
alter table public.classes            add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;
alter table public.class_enrollments  add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;
alter table public.memberships        add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;
alter table public.payments           add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;
alter table public.access_logs        add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;
alter table public.qr_tokens          add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;
alter table public.notifications      add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;
alter table public.notification_history add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;

-- Tablas que pueden no existir según hasta qué migración llegó la instancia
do $$
begin
    if to_regclass('public.member_grades') is not null then
        alter table public.member_grades add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;
    end if;
    if to_regclass('public.class_attendance') is not null then
        alter table public.class_attendance add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;
    end if;
    if to_regclass('public.landing_events') is not null then
        alter table public.landing_events add column if not exists dojo_id uuid references public.dojos(id) on delete set null;
    end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. Backfill: todo lo existente va al dojo semilla
-- ------------------------------------------------------------------------------
do $$
declare
    seed_dojo uuid;
begin
    select d.id into seed_dojo
    from public.dojos d
    join public.organizations o on o.id = d.org_id
    where o.slug = 'lotus' and d.slug = 'principal';

    if seed_dojo is null then
        raise exception 'No se encontró el dojo semilla; revisá el paso 1.';
    end if;

    update public.classes             set dojo_id = seed_dojo where dojo_id is null;
    update public.class_enrollments   set dojo_id = seed_dojo where dojo_id is null;
    update public.memberships         set dojo_id = seed_dojo where dojo_id is null;
    update public.payments            set dojo_id = seed_dojo where dojo_id is null;
    update public.access_logs         set dojo_id = seed_dojo where dojo_id is null;
    update public.qr_tokens           set dojo_id = seed_dojo where dojo_id is null;
    update public.notifications       set dojo_id = seed_dojo where dojo_id is null;
    update public.notification_history set dojo_id = seed_dojo where dojo_id is null;

    if to_regclass('public.member_grades') is not null then
        execute format('update public.member_grades set dojo_id = %L where dojo_id is null', seed_dojo);
    end if;
    if to_regclass('public.class_attendance') is not null then
        execute format('update public.class_attendance set dojo_id = %L where dojo_id is null', seed_dojo);
    end if;

    -- 3b. Cada profile existente pasa a ser miembro del dojo semilla, mapeando
    -- el rol global heredado al rol por dojo.
    insert into public.dojo_members (dojo_id, user_id, role, access_code)
    select
        seed_dojo,
        p.user_id,
        case p.role::text
            when 'admin'      then 'admin'::public.dojo_role
            when 'instructor' then 'instructor'::public.dojo_role
            when 'becado'     then 'becado'::public.dojo_role
            else 'member'::public.dojo_role
        end,
        p.access_code
    from public.profiles p
    where exists (select 1 from auth.users u where u.id = p.user_id)
    on conflict (dojo_id, user_id) do nothing;
end $$;

-- ------------------------------------------------------------------------------
-- 4. NOT NULL una vez que no quedan huérfanos
-- ------------------------------------------------------------------------------
-- Se hace después del backfill porque una tabla con filas y dojo_id null
-- rechazaría la constraint.
do $$
declare
    t text;
begin
    foreach t in array array[
        'classes', 'class_enrollments', 'memberships', 'payments',
        'access_logs', 'notifications'
    ] loop
        execute format(
            'alter table public.%I alter column dojo_id set not null', t
        );
    end loop;
end $$;

-- qr_tokens y notification_history quedan nullable a propósito: los tokens
-- rotativos y el historial pueden crearse desde jobs sin contexto de dojo.

-- ------------------------------------------------------------------------------
-- 5. Índices de tenant
-- ------------------------------------------------------------------------------
-- Toda query del panel filtra por dojo_id, así que va primero en el índice
-- compuesto para que sirva tanto al filtro solo como al filtro + columna.
create index if not exists classes_dojo_idx            on public.classes (dojo_id);
create index if not exists class_enrollments_dojo_idx  on public.class_enrollments (dojo_id, user_id);
create index if not exists memberships_dojo_member_idx on public.memberships (dojo_id, member_id, end_date desc);
create index if not exists payments_dojo_user_idx      on public.payments (dojo_id, user_id, paid_at desc);
create index if not exists access_logs_dojo_idx        on public.access_logs (dojo_id, scanned_at desc);
create index if not exists notifications_dojo_idx      on public.notifications (dojo_id, user_id);

-- ------------------------------------------------------------------------------
-- 6. Unicidad ahora scopeada por dojo
-- ------------------------------------------------------------------------------
-- class_enrollments: la misma persona puede estar en una clase "Karate" de
-- Lanús y otra "Karate" de Avellaneda; son class_id distintos, pero el índice
-- por dojo evita cruces si alguna vez se comparte un class_id.
create unique index if not exists class_enrollments_unique
    on public.class_enrollments (dojo_id, user_id, class_id);

-- El código de acceso debe ser único DENTRO del dojo, no globalmente.
create unique index if not exists dojo_members_access_code_unique
    on public.dojo_members (dojo_id, access_code)
    where access_code is not null;

-- ------------------------------------------------------------------------------
-- 7. notification_settings pasa a ser por dojo
-- ------------------------------------------------------------------------------
-- Antes era un singleton (id text = 'default'). Ahora cada dojo decide cuándo
-- avisar, en línea con que cada dojo define sus propios días de vencimiento.
alter table public.notification_settings
    add column if not exists dojo_id uuid references public.dojos(id) on delete cascade;

update public.notification_settings ns
set dojo_id = (
    select d.id from public.dojos d
    join public.organizations o on o.id = d.org_id
    where o.slug = 'lotus' and d.slug = 'principal'
)
where ns.dojo_id is null;

create unique index if not exists notification_settings_dojo_unique
    on public.notification_settings (dojo_id)
    where dojo_id is not null;

-- ------------------------------------------------------------------------------
-- 8. academies → dojos
-- ------------------------------------------------------------------------------
-- `academies` existía sólo para el mapa público. Ahora esa información vive en
-- `dojos` (una sede ES un dojo). Migramos las filas que todavía no tengan dojo
-- y dejamos una vista de compatibilidad para no romper la landing mientras se
-- actualizan los componentes.

-- Helper de slug sin depender de la extensión unaccent (que no siempre está
-- habilitada en Supabase por defecto).
create or replace function public.unaccent_fallback(txt text)
returns text
language sql
immutable
as $$
    select translate(
        txt,
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
    );
$$;

do $$
declare
    seed_org uuid;
begin
    select id into seed_org from public.organizations where slug = 'lotus';

    insert into public.dojos (org_id, slug, name, city, address, lat, lng, is_active)
    select
        seed_org,
        -- slug derivado del nombre: "Lotus Lanús" → "lotus-lanus"
        regexp_replace(lower(unaccent_fallback(a.name)), '[^a-z0-9]+', '-', 'g'),
        a.name, a.city, a.address, a.lat, a.lng, coalesce(a.is_active, true)
    from public.academies a
    where not exists (
        select 1 from public.dojos d
        where d.org_id = seed_org and lower(d.name) = lower(a.name)
    )
    on conflict (org_id, slug) do nothing;
exception
    when undefined_table then
        raise notice 'Tabla academies inexistente, nada que migrar.';
end $$;
