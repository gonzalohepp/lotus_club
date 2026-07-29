/**
 * billing.ts — Motor de mora configurable por dojo.
 *
 * Reemplaza a `pricing.ts`, que tenía las reglas de Beleza hardcodeadas
 * (1-10 sin recargo / 11-19 con 20% / 20+ bloqueado). Ahora esas mismas reglas
 * son DATOS que vienen de `dojos.billing`, y cada dueño configura las suyas
 * desde la UI.
 *
 * ⚠️ Este archivo es el espejo exacto de `public.billing_eval()`
 * (supabase/migrations/20260727120200_billing_engine.sql). Si tocás una regla
 * acá, tocala allá. Para verificar que no se desincronizaron, corré
 * `database/verify-billing-parity.sql` en el SQL editor de Supabase: evalúa los
 * mismos casos borde que documenta este archivo y marca los que no dan.
 *
 * ¿Por qué duplicar? El servidor necesita el cálculo en SQL para que las vistas
 * (`members_with_status`) filtren y ordenen por estado, y el cliente lo necesita
 * en TS para pintar el estado al vuelo sin round-trip. Como la LÓGICA es la
 * misma y lo que cambia es la CONFIG, ambas implementaciones leen el mismo JSON.
 */

import { DEFAULT_BILLING, type BillingConfig, type BillingTier, type DojoRole } from './tenant/types'

export type BillingPhase = 'al_dia' | 'gracia' | 'bloqueado' | 'sin_membresia'

export type BillingResult = {
    phase: BillingPhase
    /** Compat con la UI actual, que sólo distingue activo/vencido. */
    status: 'activo' | 'vencido'
    surchargePct: number
    /** Multiplicador a aplicar sobre la cuota base (1.0, 1.2, ...). */
    multiplier: number
    /** ¿El QR debe rechazar el ingreso? */
    blocksAccess: boolean
    tierLabel: string | null
    daysOverdue: number
    monthsOverdue: number
}

const OK: BillingResult = {
    phase: 'al_dia',
    status: 'activo',
    surchargePct: 0,
    multiplier: 1,
    blocksAccess: false,
    tierLabel: null,
    daysOverdue: 0,
    monthsOverdue: 0,
}

/**
 * "Hoy" en la zona horaria del dojo. Un dojo en Buenos Aires y un servidor en
 * UTC pueden estar en días distintos, y el día del mes es justamente lo que
 * decide el tramo de recargo — así que esto no es un detalle cosmético.
 */
export function todayInZone(timezone = 'America/Argentina/Buenos_Aires'): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date())

    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    return new Date(get('year'), get('month') - 1, get('day'))
}

/** Parsea 'YYYY-MM-DD' como fecha local, sin correrse un día por UTC. */
function parseDate(value: string | Date): Date {
    if (value instanceof Date) return value
    const [y, m, d] = value.slice(0, 10).split('-').map(Number)
    return new Date(y, m - 1, d)
}

function daysBetween(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function monthsBetween(from: Date, to: Date): number {
    return (to.getFullYear() * 12 + to.getMonth()) - (from.getFullYear() * 12 + from.getMonth())
}

/** Busca el tramo que cubre ese día del mes. `to_day: null` = sin techo. */
function findTier(tiers: BillingTier[], dayOfMonth: number): BillingTier | null {
    return (
        [...tiers]
            .sort((a, b) => b.from_day - a.from_day)
            .find((t) => t.from_day <= dayOfMonth && (t.to_day === null || t.to_day >= dayOfMonth)) ?? null
    )
}

export type BillingInput = {
    /** Vencimiento de la membresía vigente en ESTE dojo. */
    endDate: string | Date | null | undefined
    role?: DojoRole | string | null
    /** El alumno todavía no registró ningún pago en este dojo. */
    isNewMember?: boolean
    timezone?: string
    /** Para tests y simulaciones ("¿qué pasa si hoy fuera el día 15?"). */
    referenceDate?: Date
}

/**
 * Evalúa el estado de cuota de una persona bajo las reglas de un dojo.
 *
 * El orden de las reglas importa y es el mismo que en SQL:
 *   1. rol exento → al día
 *   2. sin membresía → vencido (pero no bloqueado: es un alta incompleta)
 *   3. vencimiento en el futuro → al día
 *   4. alumno nuevo exento → gracia sin recargo
 *   5. N meses de atraso → bloqueado con el recargo máximo
 *   6. tramo según el día del mes de hoy
 */
export function evaluateBilling(config: BillingConfig | null | undefined, input: BillingInput): BillingResult {
    const cfg: BillingConfig = { ...DEFAULT_BILLING, ...(config ?? {}) }
    const today = input.referenceDate ?? todayInZone(input.timezone)

    // 1. Roles exentos: staff y becados nunca deben cuota.
    if (input.role && (cfg.exempt_roles as string[]).includes(input.role)) {
        return { ...OK, tierLabel: 'Exento' }
    }

    // 2. Sin membresía cargada.
    if (!input.endDate) {
        return { ...OK, phase: 'sin_membresia', status: 'vencido', tierLabel: 'Sin membresía' }
    }

    const due = parseDate(input.endDate)

    // Convención heredada: 2099-12-31 = membresía vitalicia.
    if (due.getFullYear() >= 2099) return { ...OK, tierLabel: 'Vitalicia' }

    // 3. Todavía vigente.
    if (due >= today) return { ...OK, tierLabel: 'Al día' }

    const daysOverdue = daysBetween(due, today)
    const monthsOverdue = Math.max(monthsBetween(due, today), 0)

    // 4. Alumno nuevo sin historial de pagos.
    if (input.isNewMember && cfg.new_member_exempt) {
        return { ...OK, phase: 'gracia', tierLabel: 'Alumno nuevo', daysOverdue, monthsOverdue }
    }

    // 5. Atraso de N meses o más → bloqueo directo con el recargo más alto.
    if (monthsOverdue >= cfg.months_overdue_blocks) {
        const maxSurcharge = cfg.tiers.reduce((max, t) => Math.max(max, t.surcharge_pct), 0)
        return {
            phase: 'bloqueado',
            status: 'vencido',
            surchargePct: maxSurcharge,
            multiplier: 1 + maxSurcharge / 100,
            blocksAccess: true,
            tierLabel: `${monthsOverdue} meses de atraso`,
            daysOverdue,
            monthsOverdue,
        }
    }

    // 6. Dentro del mes de gracia: manda el día del mes de HOY.
    const tier = findTier(cfg.tiers, today.getDate())

    if (!tier) {
        return { ...OK, phase: 'gracia', tierLabel: 'Sin recargo', daysOverdue, monthsOverdue }
    }

    return {
        phase: tier.blocks_access ? 'bloqueado' : 'gracia',
        status: tier.blocks_access ? 'vencido' : 'activo',
        surchargePct: tier.surcharge_pct,
        multiplier: 1 + tier.surcharge_pct / 100,
        blocksAccess: tier.blocks_access,
        tierLabel: tier.label,
        daysOverdue,
        monthsOverdue,
    }
}


/**
 * Mensaje para el alumno, derivado de la config real del dojo en vez de textos
 * fijos con "día 10" y "20%" quemados.
 */
export function billingMessage(config: BillingConfig | null | undefined, result: BillingResult): string {
    const cfg: BillingConfig = { ...DEFAULT_BILLING, ...(config ?? {}) }

    switch (result.phase) {
        case 'al_dia':
            if (result.tierLabel === 'Exento' || result.tierLabel === 'Vitalicia') {
                return 'Tu membresía no tiene vencimiento'
            }
            return 'Estás al día'

        case 'sin_membresia':
            return 'Todavía no tenés una membresía activa'

        case 'gracia': {
            if (result.surchargePct > 0) {
                return `+${result.surchargePct}% de recargo por pago tardío`
            }
            // Buscamos hasta qué día llega el tramo sin recargo, para avisar.
            const free = cfg.tiers.find((t) => t.surcharge_pct === 0)
            return free?.to_day
                ? `Pagá sin recargo hasta el día ${free.to_day}`
                : 'Pagá sin recargo'
        }

        case 'bloqueado':
            return result.surchargePct > 0
                ? `Acceso bloqueado. Podés regularizar con ${result.surchargePct}% de recargo`
                : 'Acceso bloqueado. Regularizá tu situación'
    }
}

/**
 * Resumen legible de las reglas de un dojo, para mostrar en la pantalla de
 * configuración ("así queda tu política de cobro").
 */
export function describeBilling(config: BillingConfig | null | undefined): string[] {
    const cfg: BillingConfig = { ...DEFAULT_BILLING, ...(config ?? {}) }

    const lines = [...cfg.tiers]
        .sort((a, b) => a.from_day - b.from_day)
        .map((t) => {
            const range = t.to_day === null ? `Del ${t.from_day} en adelante` : `Del ${t.from_day} al ${t.to_day}`
            const charge = t.surcharge_pct > 0 ? `+${t.surcharge_pct}% de recargo` : 'sin recargo'
            const block = t.blocks_access ? ', acceso bloqueado' : ''
            return `${range}: ${charge}${block}`
        })

    lines.push(`${cfg.months_overdue_blocks} meses de atraso: acceso bloqueado`)
    return lines
}
