-- ==============================================================================
-- MOTOR DE COBRO CONFIGURABLE POR DOJO
-- ==============================================================================
-- Reemplaza la lógica hardcodeada (días 1-10 sin recargo / 11-19 con 20% /
-- 20+ bloqueado) por reglas que vienen de `dojos.billing`, de modo que cada
-- dueño configure las suyas desde la UI sin tocar código ni SQL.
--
-- Forma de `dojos.billing`:
-- {
--   "due_day": 10,                       -- día de vencimiento de referencia (informativo/UI)
--   "tiers": [                           -- tramos por día del mes, evaluados sobre la fecha actual
--     { "from_day": 1,  "to_day": 10,   "surcharge_pct": 0,  "blocks_access": false, "label": "Sin recargo" },
--     { "from_day": 11, "to_day": 19,   "surcharge_pct": 20, "blocks_access": false, "label": "Con recargo" },
--     { "from_day": 20, "to_day": null, "surcharge_pct": 20, "blocks_access": true,  "label": "Bloqueado"  }
--   ],
--   "months_overdue_blocks": 2,          -- N meses de atraso ⇒ bloqueo directo, sin importar el día
--   "exempt_roles": ["owner","admin","instructor","becado"],
--   "new_member_exempt": true,           -- alumno sin ningún pago todavía no arrastra recargo
--   "currency": "ARS",
--   "rounding": 0                        -- redondeo del importe final (0 = sin redondeo, 10 = a $10)
-- }
--
-- `to_day: null` = "de ahí en adelante". Los tramos no necesitan cubrir todo el
-- mes: si un día no cae en ningún tramo se asume sin recargo y sin bloqueo.
--
-- Este archivo es la ÚNICA fuente de verdad del cálculo. El equivalente en
-- TypeScript (src/lib/billing.ts) interpreta el MISMO JSON con las mismas
-- reglas, así que cambiar la config cambia ambos lados a la vez.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Tipo de retorno del motor
-- ------------------------------------------------------------------------------
do $$
begin
    if not exists (select 1 from pg_type where typname = 'billing_result') then
        create type public.billing_result as (
            phase          text,     -- al_dia | gracia | bloqueado | sin_membresia
            status         text,     -- activo | vencido  (compat con la UI actual)
            surcharge_pct  numeric,  -- 0, 20, ...
            multiplier     numeric,  -- 1.0, 1.2, ... (para multiplicar la cuota)
            blocks_access  boolean,  -- ¿el QR debe rechazar el ingreso?
            tier_label     text,     -- etiqueta del tramo, para mostrar en UI
            days_overdue   integer,  -- días desde el vencimiento (0 si está al día)
            months_overdue integer   -- meses calendario de atraso
        );
    end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. El motor
-- ------------------------------------------------------------------------------
create or replace function public.billing_eval(
    config     jsonb,
    end_date   date,      -- vencimiento de la membresía vigente
    ref_date   date default current_date,
    role       text default 'member',
    is_new     boolean default false
)
returns public.billing_result
language plpgsql
immutable
as $$
declare
    res            public.billing_result;
    tier           jsonb;
    day_of_month   integer;
    n_months       integer;
    n_days         integer;
    block_after    integer;
    max_surcharge  numeric;
begin
    -- Defaults seguros: sin config, nadie queda bloqueado por accidente.
    res.phase          := 'al_dia';
    res.status         := 'activo';
    res.surcharge_pct  := 0;
    res.multiplier     := 1.0;
    res.blocks_access  := false;
    res.tier_label     := null;
    res.days_overdue   := 0;
    res.months_overdue := 0;

    config := coalesce(config, '{}'::jsonb);

    -- (a) Roles exentos: staff y becados nunca deben cuota.
    if role = any (
        select jsonb_array_elements_text(
            coalesce(config->'exempt_roles', '["owner","admin","instructor","becado"]'::jsonb)
        )
    ) then
        res.tier_label := 'Exento';
        return res;
    end if;

    -- (b) Sin membresía cargada: no es "vencido", es un alta incompleta.
    if end_date is null then
        res.phase      := 'sin_membresia';
        res.status     := 'vencido';
        res.tier_label := 'Sin membresía';
        return res;
    end if;

    -- (c) Todavía vigente.
    if end_date >= ref_date then
        res.tier_label := 'Al día';
        return res;
    end if;

    -- (d) Vencido: calculamos atraso.
    res.days_overdue := ref_date - end_date;

    n_months :=
        (extract(year from ref_date)::int * 12 + extract(month from ref_date)::int)
      - (extract(year from end_date)::int * 12 + extract(month from end_date)::int);
    res.months_overdue := greatest(n_months, 0);

    -- (e) Alumno nuevo sin historial de pagos: se le muestra el vencimiento
    -- pero no se le cobra recargo si el dojo así lo configuró.
    if is_new and coalesce((config->>'new_member_exempt')::boolean, true) then
        res.phase      := 'gracia';
        res.tier_label := 'Alumno nuevo';
        return res;
    end if;

    -- (f) Atraso de N meses o más ⇒ bloqueo directo, con el recargo más alto
    -- que defina la tabla de tramos.
    block_after := coalesce((config->>'months_overdue_blocks')::int, 2);

    if res.months_overdue >= block_after then
        select coalesce(max((t->>'surcharge_pct')::numeric), 0)
        into max_surcharge
        from jsonb_array_elements(coalesce(config->'tiers', '[]'::jsonb)) t;

        res.phase         := 'bloqueado';
        res.status        := 'vencido';
        res.surcharge_pct := max_surcharge;
        res.multiplier    := 1 + (max_surcharge / 100.0);
        res.blocks_access := true;
        res.tier_label    := format('%s meses de atraso', res.months_overdue);
        return res;
    end if;

    -- (g) Dentro del mes de gracia: manda el día del mes de HOY.
    day_of_month := extract(day from ref_date)::int;

    select t
    into tier
    from jsonb_array_elements(coalesce(config->'tiers', '[]'::jsonb)) t
    where (t->>'from_day')::int <= day_of_month
      and ((t->>'to_day') is null or (t->>'to_day')::int >= day_of_month)
    order by (t->>'from_day')::int desc
    limit 1;

    if tier is null then
        -- Día no cubierto por ningún tramo: se trata como gracia sin recargo.
        res.phase      := 'gracia';
        res.tier_label := 'Sin recargo';
        return res;
    end if;

    res.surcharge_pct := coalesce((tier->>'surcharge_pct')::numeric, 0);
    res.multiplier    := 1 + (res.surcharge_pct / 100.0);
    res.blocks_access := coalesce((tier->>'blocks_access')::boolean, false);
    res.tier_label    := tier->>'label';
    res.phase         := case when res.blocks_access then 'bloqueado' else 'gracia' end;
    res.status        := case when res.blocks_access then 'vencido' else 'activo' end;

    return res;
end;
$$;

comment on function public.billing_eval is
    'Motor de mora. Interpreta dojos.billing y devuelve fase, recargo y si bloquea el acceso.';

-- Azúcar: evaluar directo por dojo, leyendo su config.
create or replace function public.billing_eval_for_dojo(
    p_dojo_id  uuid,
    p_end_date date,
    p_ref_date date default current_date,
    p_role     text default 'member',
    p_is_new   boolean default false
)
returns public.billing_result
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.billing_eval(d.billing, p_end_date, p_ref_date, p_role, p_is_new)
    from public.dojos d
    where d.id = p_dojo_id;
$$;

-- Aplica recargo + redondeo del dojo a un importe base.
create or replace function public.billing_apply(
    config jsonb,
    base   numeric,
    mult   numeric
)
returns numeric
language sql
immutable
as $$
    select case
        when coalesce((config->>'rounding')::numeric, 0) > 0
            then round((base * mult) / (config->>'rounding')::numeric)
                 * (config->>'rounding')::numeric
        else round(base * mult, 2)
    end;
$$;

-- ==============================================================================
-- 3. VISTAS REESCRITAS — ahora por (dojo_id, user_id)
-- ==============================================================================
-- La clave del multi-tenant: un alumno que va a Lanús y a Avellaneda aparece
-- DOS veces, una por dojo, cada una con el estado que le corresponde según las
-- reglas de ESE dojo. El panel filtra por `dojo_id` del dojo activo.
-- ------------------------------------------------------------------------------

drop view if exists public.dashboard_stats;
drop view if exists public.members_with_status cascade;

create view public.members_with_status
with (security_invoker = true)
as
with latest_membership as (
    -- Última membresía de cada persona EN CADA DOJO.
    select distinct on (m.dojo_id, m.member_id)
        m.dojo_id, m.member_id, m.type, m.end_date, m.start_date, m.last_payment_date
    from public.memberships m
    order by m.dojo_id, m.member_id, m.end_date desc
),
paid_current_period as (
    -- ¿Tiene un pago que cubre hoy, en este dojo?
    select distinct p.dojo_id, p.user_id
    from public.payments p
    where p.period_from <= current_date
      and p.period_to   >= current_date
),
ever_paid as (
    select distinct p.dojo_id, p.user_id from public.payments p
),
enrolled as (
    -- Clases y cuota estimada, contando SÓLO las clases de ese dojo.
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

    -- Motor de cobro con la config del dojo al que pertenece esta fila.
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
    -- Un pago que cubre el período actual pisa el vencimiento: está al día
    -- aunque la fila de membership haya quedado desactualizada.
    case when pc.user_id is not null then greatest(lm.end_date, current_date) else lm.end_date end,
    current_date,
    dm.role::text,
    (ep.user_id is null)
) b
where dm.is_active;

comment on view public.members_with_status is
    'Una fila por (dojo, persona). El mismo alumno en dos dojos aparece dos veces, con el estado de cada uno.';

-- ------------------------------------------------------------------------------
-- 4. Dashboard por dojo
-- ------------------------------------------------------------------------------
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
        count(b.user_id)                                             as members_total,
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

-- ------------------------------------------------------------------------------
-- 5. Permisos
-- ------------------------------------------------------------------------------
-- security_invoker = true ⇒ las vistas respetan la RLS del usuario que consulta,
-- no la del owner. Sin esto, cualquier autenticado leería todos los dojos.
grant select on public.members_with_status to authenticated, service_role;
grant select on public.dashboard_stats     to authenticated, service_role;
grant execute on function public.billing_eval(jsonb, date, date, text, boolean) to anon, authenticated, service_role;
grant execute on function public.billing_eval_for_dojo(uuid, date, date, text, boolean) to authenticated, service_role;
grant execute on function public.billing_apply(jsonb, numeric, numeric) to anon, authenticated, service_role;
