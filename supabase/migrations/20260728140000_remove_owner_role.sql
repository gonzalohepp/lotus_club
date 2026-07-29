-- ==============================================================================
-- ELIMINAR EL ROL `owner` DE SEDE
-- ==============================================================================
-- El modelo de roles queda en cinco niveles, sin dueño de sucursal:
--
--   desarrollador   platform_admins            todo + /superadmin
--   superadmin      org_members                todo menos /superadmin
--   administrador   dojo_members 'admin'       su sede, sin "Academias"
--   instructor      dojo_members 'instructor'  su sede, con sus limitantes
--   alumno          dojo_members 'member'      sólo perfil y validate
--
-- `becado` SE MANTIENE: no es un nivel de permisos sino una variante de alumno
-- (exento de cuota). Lo usa el motor de cobro en `exempt_roles` y la UI de
-- miembros; sacarlo eliminaría esa funcionalidad, que es otra cosa distinta de
-- lo que se pidió.
--
-- Consecuencia de negocio: sin `owner`, quien configura la lógica de cobro de
-- cada sede es el superadmin de la marca. Las reglas siguen siendo POR DOJO
-- (cada sucursal con las suyas), sólo cambia quién las edita.
--
-- Nota técnica: Postgres no permite quitar valores de un enum, así que hay que
-- recrear el tipo. Y como `members_with_status` y `dashboard_stats` dependen de
-- `dojo_members.role`, hay que dropearlas antes del ALTER y volver a crearlas
-- después — por eso este archivo repite su definición.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Migrar los datos: todo owner pasa a admin
-- ------------------------------------------------------------------------------
update public.dojo_members     set role = 'admin' where role = 'owner';
update public.dojo_invitations set role = 'admin' where role = 'owner';

-- ------------------------------------------------------------------------------
-- 2. Recrear el enum sin `owner`
-- ------------------------------------------------------------------------------
drop view if exists public.dashboard_stats;
drop view if exists public.members_with_status cascade;

alter type public.dojo_role rename to dojo_role_old;

create type public.dojo_role as enum ('admin', 'instructor', 'member', 'becado');

alter table public.dojo_members     alter column role drop default;
alter table public.dojo_invitations alter column role drop default;

alter table public.dojo_members
    alter column role type public.dojo_role using role::text::public.dojo_role;
alter table public.dojo_invitations
    alter column role type public.dojo_role using role::text::public.dojo_role;

alter table public.dojo_members     alter column role set default 'member';
alter table public.dojo_invitations alter column role set default 'admin';

drop type public.dojo_role_old;

-- ------------------------------------------------------------------------------
-- 3. Helpers sin referencias a `owner`
-- ------------------------------------------------------------------------------
-- `my_manager_dojo_ids` (quien toca plata y configuración) queda en: superadmin
-- de la marca, o administrador de la sede.
create or replace function public.my_staff_dojo_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(distinct d.id), '{}'::uuid[])
    from public.dojos d
    where d.org_id = any (public.my_org_ids())
       or exists (
            select 1 from public.dojo_members dm
            where dm.dojo_id = d.id
              and dm.user_id = auth.uid()
              and dm.is_active
              and dm.role in ('admin', 'instructor')
       );
$$;

create or replace function public.my_manager_dojo_ids()
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

-- ------------------------------------------------------------------------------
-- 4. Config de cobro: sacar `owner` de los roles exentos
-- ------------------------------------------------------------------------------
update public.dojos
set billing = jsonb_set(
    billing,
    '{exempt_roles}',
    jsonb_build_array('admin', 'instructor', 'becado')
)
where billing ? 'exempt_roles'
  and billing->'exempt_roles' @> '"owner"'::jsonb;

alter table public.dojos alter column billing set default jsonb_build_object(
    'due_day', 10,
    'tiers', jsonb_build_array(
        jsonb_build_object('from_day', 1,  'to_day', 10,   'surcharge_pct', 0,  'blocks_access', false, 'label', 'Sin recargo'),
        jsonb_build_object('from_day', 11, 'to_day', 19,   'surcharge_pct', 20, 'blocks_access', false, 'label', 'Con recargo'),
        jsonb_build_object('from_day', 20, 'to_day', null, 'surcharge_pct', 20, 'blocks_access', true,  'label', 'Bloqueado')
    ),
    'months_overdue_blocks', 2,
    'exempt_roles', jsonb_build_array('admin', 'instructor', 'becado'),
    'new_member_exempt', true,
    'currency', 'ARS',
    'rounding', 0
);

-- ------------------------------------------------------------------------------
-- 5. Recrear las vistas (idénticas a 20260727120200, que ahora compilan contra
--    el enum nuevo)
-- ------------------------------------------------------------------------------
create view public.members_with_status
with (security_invoker = true)
as
with latest_membership as (
    select distinct on (m.dojo_id, m.member_id)
        m.dojo_id, m.member_id, m.type, m.end_date, m.start_date, m.last_payment_date
    from public.memberships m
    order by m.dojo_id, m.member_id, m.end_date desc
),
paid_current_period as (
    select distinct p.dojo_id, p.user_id
    from public.payments p
    where p.period_from <= current_date
      and p.period_to   >= current_date
),
ever_paid as (
    select distinct p.dojo_id, p.user_id from public.payments p
),
enrolled as (
    select
        ce.dojo_id,
        ce.user_id,
        json_agg(c.name order by c.name) as class_names,
        array_agg(c.id order by c.id)    as class_ids,
        coalesce(sum(
            case when ce.is_principal
                then c.price_principal
                else coalesce(c.price_additional, c.price_principal)
            end
        ), 0) as estimated_monthly_fee
    from public.class_enrollments ce
    join public.classes c on c.id = ce.class_id and c.dojo_id = ce.dojo_id
    group by ce.dojo_id, ce.user_id
)
select
    dm.dojo_id,
    d.org_id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.emergency_phone,
    p.avatar_url,
    dm.notes,
    dm.access_code,
    dm.role::text                        as role,
    dm.is_active                         as membership_active,
    dm.joined_at,
    lm.type                              as membership_type,
    lm.end_date                          as next_payment_due,
    lm.start_date,
    lm.last_payment_date,
    en.class_names,
    en.class_ids,
    coalesce(en.estimated_monthly_fee, 0) as estimated_monthly_fee,
    (ep.user_id is null)                  as is_new_member,
    b.phase,
    b.status,
    b.surcharge_pct,
    b.multiplier,
    b.blocks_access,
    b.tier_label,
    b.days_overdue,
    b.months_overdue,
    public.billing_apply(
        d.billing,
        coalesce(en.estimated_monthly_fee, 0),
        b.multiplier
    ) as amount_due
from public.dojo_members dm
join public.dojos    d on d.id = dm.dojo_id
join public.profiles p on p.user_id = dm.user_id
left join latest_membership   lm on lm.dojo_id = dm.dojo_id and lm.member_id = dm.user_id
left join enrolled            en on en.dojo_id = dm.dojo_id and en.user_id   = dm.user_id
left join paid_current_period pc on pc.dojo_id = dm.dojo_id and pc.user_id   = dm.user_id
left join ever_paid           ep on ep.dojo_id = dm.dojo_id and ep.user_id   = dm.user_id
cross join lateral public.billing_eval(
    d.billing,
    case when pc.user_id is not null then greatest(lm.end_date, current_date) else lm.end_date end,
    current_date,
    dm.role::text,
    (ep.user_id is null)
) b
where dm.is_active;

comment on view public.members_with_status is
    'Una fila por (dojo, persona). El mismo alumno en dos dojos aparece dos veces, con el estado de cada uno.';

create view public.dashboard_stats
with (security_invoker = true)
as
with base as (
    select * from public.members_with_status where role = 'member'
),
per_dojo as (
    select
        d.id as dojo_id,
        d.org_id,
        count(b.user_id)                                              as members_total,
        count(b.user_id) filter (where b.status = 'activo')           as members_active,
        count(b.user_id) filter (where b.status = 'vencido')          as members_inactive,
        count(b.user_id) filter (where b.phase  = 'gracia')           as members_in_grace,
        count(b.user_id) filter (where b.blocks_access)               as members_blocked
    from public.dojos d
    left join base b on b.dojo_id = d.id
    group by d.id, d.org_id
),
revenue as (
    select dojo_id, coalesce(sum(amount), 0) as total_month
    from public.payments
    where date_trunc('month', paid_at) = date_trunc('month', current_date)
    group by dojo_id
),
access_today as (
    select
        dojo_id,
        count(*) filter (where result in ('authorized','autorizado','success','ok')) as success,
        count(*) filter (where result in ('denied','denegado','rejected'))            as denied
    from public.access_logs
    where scanned_at >= current_date
    group by dojo_id
)
select
    pd.dojo_id,
    pd.org_id,
    pd.members_total,
    pd.members_active,
    pd.members_inactive,
    pd.members_in_grace,
    pd.members_blocked,
    coalesce(at.success, 0)      as accesses_success_today,
    coalesce(at.denied, 0)       as accesses_denied_today,
    coalesce(r.total_month, 0)   as revenue_this_month,
    (
        select json_agg(e)
        from (
            select user_id, first_name, last_name, phone,
                   next_payment_due as end_date, phase, tier_label, amount_due
            from base
            where base.dojo_id = pd.dojo_id
              and (
                    (next_payment_due >= current_date
                     and next_payment_due <= current_date + interval '7 days')
                 or phase in ('gracia', 'bloqueado')
              )
            order by next_payment_due asc nulls last
            limit 15
        ) e
    ) as expiring_next_7d
from per_dojo pd
left join revenue      r  on r.dojo_id  = pd.dojo_id
left join access_today at on at.dojo_id = pd.dojo_id;

grant select on public.members_with_status to authenticated, service_role;
grant select on public.dashboard_stats     to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. Verificación
-- ------------------------------------------------------------------------------
--   select unnest(enum_range(null::public.dojo_role));   -- sin 'owner'
--   select role, count(*) from public.dojo_members group by 1;
