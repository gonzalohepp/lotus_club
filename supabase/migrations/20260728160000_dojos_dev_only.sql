-- ==============================================================================
-- LAS SEDES LAS DA DE ALTA SÓLO EL DESARROLLADOR
-- ==============================================================================
-- Corrección del modelo: el superadmin de una marca VE sus academias, pero no
-- las crea, edita ni borra. Si necesita una sede nueva, la pide al desarrollador.
--
-- Es coherente con que el plan (Basic = 1 sede, Pro = ilimitadas) es una
-- condición COMERCIAL: si el dueño de la marca pudiera crear sedes solo, el
-- límite de plan sería una sugerencia. Dejarlo del lado del dev lo convierte en
-- una decisión de negocio con una persona atrás.
--
-- Antes: la policy "dojos manage org" (20260728130000) daba INSERT/UPDATE/DELETE
-- a cualquier superadmin de la organización, y "dojos update own" se lo daba
-- además a los administradores de sede.
-- ==============================================================================

-- Alta, baja y edición de sedes: exclusivo del desarrollador.
drop policy if exists "dojos manage org" on public.dojos;
drop policy if exists "dojos update own" on public.dojos;

-- Quedan vigentes de migraciones anteriores:
--   "dojos read own"       select  → belongs_to_dojo(id)      (incluye superadmin de marca)
--   "dojos public map"     select  → is_active, para anon     (mapa de la landing)
--   "dojos manage platform" all    → is_platform_admin()      (el desarrollador)

-- ------------------------------------------------------------------------------
-- El trigger de cobro pasa a ser redundante, pero se deja
-- ------------------------------------------------------------------------------
-- Con las sedes ya cerradas al dev, nadie más puede hacer UPDATE sobre `dojos`,
-- así que `enforce_billing_dev_only()` no llegaría a dispararse. Se conserva a
-- propósito: si mañana se le devuelve a la marca la edición de su propia sede
-- (nombre, dirección, branding), la columna `billing` sigue protegida sin que
-- haya que acordarse de volver a restringirla.

-- ------------------------------------------------------------------------------
-- Limpieza: el dev y los superadmins de marca no son miembros de un dojo
-- ------------------------------------------------------------------------------
-- Su acceso viene de `platform_admins` y `org_members`. La fila en
-- `dojo_members` es redundante y tiene un efecto visible feo: los hace aparecer
-- en "Gestión de Miembros" como si fueran alumnos de esa sede.
--
-- Sólo se borran las filas que NO aportan nada: si alguien es superadmin de la
-- marca y además da clases en una sucursal puntual (rol `instructor`), esa fila
-- sí es información real y se respeta.
delete from public.dojo_members dm
where dm.role = 'admin'
  and (
      exists (select 1 from public.platform_admins pa where pa.user_id = dm.user_id)
      or exists (
          select 1
          from public.org_members om
          join public.dojos d on d.id = dm.dojo_id
          where om.user_id = dm.user_id
            and om.org_id = d.org_id
            and om.is_active
      )
  );

-- ------------------------------------------------------------------------------
-- Y que no vuelvan a aparecer
-- ------------------------------------------------------------------------------
-- `members_with_status` alimenta la pantalla de miembros y el dashboard. El
-- desarrollador nunca es alumno de nadie, así que se excluye de raíz: si en
-- algún momento se le crea una fila en `dojo_members` (por una invitación, por
-- un alta manual), no ensucia el padrón ni las métricas de ninguna sede.
create or replace view public.members_with_status
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
where dm.is_active
  -- El desarrollador de la plataforma no es alumno de ninguna sede.
  and not exists (
      select 1 from public.platform_admins pa where pa.user_id = dm.user_id
  );

comment on view public.members_with_status is
    'Una fila por (dojo, persona), excluyendo al desarrollador. El mismo alumno en dos dojos aparece dos veces, con el estado de cada uno.';

grant select on public.members_with_status to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------------------------
--   -- Debe devolver 0: el dev no figura como miembro en ninguna sede
--   select count(*) from public.members_with_status m
--   join public.platform_admins pa on pa.user_id = m.user_id;
--
--   -- Policies vigentes sobre dojos: sólo read/public/manage-platform
--   select polname, polcmd from pg_policy
--   where polrelid = 'public.dojos'::regclass order by 1;
