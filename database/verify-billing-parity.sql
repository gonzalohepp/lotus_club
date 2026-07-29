-- ==============================================================================
-- VERIFICACIÓN DEL MOTOR DE COBRO
-- ==============================================================================
-- Corré este script en el SQL editor de Supabase después de tocar
-- `billing_eval()` (SQL) o `src/lib/billing.ts` (TypeScript).
--
-- Evalúa los casos borde de la política clásica (1-10 sin recargo / 11-19 con
-- 20% / 20+ bloqueado) y compara contra los valores esperados. Cualquier fila
-- con ✗ significa que el motor cambió de comportamiento.
--
-- Los mismos casos están replicados en el simulador de la UI
-- (/superadmin → sede → Lógica de cobro), así que si acá da ✓ y en pantalla se
-- ve distinto, el que se desincronizó es el TypeScript.
-- ==============================================================================

with config as (
    select jsonb_build_object(
        'due_day', 10,
        'tiers', jsonb_build_array(
            jsonb_build_object('from_day', 1,  'to_day', 10,   'surcharge_pct', 0,  'blocks_access', false, 'label', 'Sin recargo'),
            jsonb_build_object('from_day', 11, 'to_day', 19,   'surcharge_pct', 20, 'blocks_access', false, 'label', 'Con recargo'),
            jsonb_build_object('from_day', 20, 'to_day', null, 'surcharge_pct', 20, 'blocks_access', true,  'label', 'Bloqueado')
        ),
        'months_overdue_blocks', 2,
        'exempt_roles', jsonb_build_array('owner', 'admin', 'instructor', 'becado'),
        'new_member_exempt', true,
        'currency', 'ARS',
        'rounding', 0
    ) as cfg
),
cases (descripcion, end_date, ref_date, rol, es_nuevo, esp_fase, esp_mult, esp_bloquea) as (
    values
    -- Vigente
    ('Cuota al día',                  date '2026-08-31', date '2026-08-15', 'member', false, 'al_dia',     1.0, false),
    ('Vence hoy',                     date '2026-08-15', date '2026-08-15', 'member', false, 'al_dia',     1.0, false),

    -- Mes de gracia: manda el día del mes de HOY
    ('Venció, hoy es 5',              date '2026-07-31', date '2026-08-05', 'member', false, 'gracia',     1.0, false),
    ('Venció, hoy es 10 (borde)',     date '2026-07-31', date '2026-08-10', 'member', false, 'gracia',     1.0, false),
    ('Venció, hoy es 11 (borde)',     date '2026-07-31', date '2026-08-11', 'member', false, 'gracia',     1.2, false),
    ('Venció, hoy es 19 (borde)',     date '2026-07-31', date '2026-08-19', 'member', false, 'gracia',     1.2, false),
    ('Venció, hoy es 20 (borde)',     date '2026-07-31', date '2026-08-20', 'member', false, 'bloqueado',  1.2, true),
    ('Venció, hoy es 28',             date '2026-07-31', date '2026-08-28', 'member', false, 'bloqueado',  1.2, true),

    -- Atraso de 2+ meses: bloquea sin importar el día
    ('2 meses de atraso, día 5',      date '2026-06-30', date '2026-08-05', 'member', false, 'bloqueado',  1.2, true),
    ('Cruce de año (dic → feb)',      date '2025-12-31', date '2026-02-05', 'member', false, 'bloqueado',  1.2, true),
    ('Cruce de año (dic → ene, d5)',  date '2025-12-31', date '2026-01-05', 'member', false, 'gracia',     1.0, false),

    -- Exenciones
    ('Instructor vencido',            date '2026-01-31', date '2026-08-25', 'instructor', false, 'al_dia', 1.0, false),
    ('Becado vencido',                date '2026-01-31', date '2026-08-25', 'becado',     false, 'al_dia', 1.0, false),
    ('Admin vencido',                 date '2026-01-31', date '2026-08-25', 'admin',      false, 'al_dia', 1.0, false),
    ('Alumno nuevo, hoy es 25',       date '2026-07-31', date '2026-08-25', 'member',     true,  'gracia', 1.0, false),

    -- Sin membresía
    ('Sin membresía cargada',         null,              date '2026-08-15', 'member', false, 'sin_membresia', 1.0, false)
)
select
    case
        when r.phase = c.esp_fase
         and r.multiplier = c.esp_mult
         and r.blocks_access = c.esp_bloquea
        then '✓' else '✗ REVISAR'
    end                                as ok,
    c.descripcion,
    r.phase                            as fase_obtenida,
    c.esp_fase                         as fase_esperada,
    r.multiplier                       as mult_obtenido,
    c.esp_mult                         as mult_esperado,
    r.blocks_access                    as bloquea_obtenido,
    c.esp_bloquea                      as bloquea_esperado,
    r.tier_label                       as etiqueta
from cases c
cross join config cfg
cross join lateral public.billing_eval(cfg.cfg, c.end_date, c.ref_date, c.rol, c.es_nuevo) r
order by (r.phase = c.esp_fase and r.multiplier = c.esp_mult and r.blocks_access = c.esp_bloquea), c.descripcion;

-- ------------------------------------------------------------------------------
-- Chequeo de aislamiento entre dojos (correr como un admin de una sola sede)
-- ------------------------------------------------------------------------------
-- Debería devolver SÓLO el dojo donde ese usuario es staff. Si aparece más de
-- uno, alguna política de RLS quedó abierta.
--
--   select distinct dojo_id from public.members_with_status;
--
-- Y esto debería devolver 0 filas (ninguna tabla de public sin RLS):
--
--   select c.relname
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
--   order by 1;
