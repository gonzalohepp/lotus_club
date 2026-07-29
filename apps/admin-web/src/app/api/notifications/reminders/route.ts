import { NextResponse } from 'next/server'
import webpush, { WebPushError, type PushSubscription } from 'web-push'

import { requireCronSecret } from '@/lib/requireCronSecret'
import { requireFeature } from '@/lib/requireAdmin'
import { serviceClient, type ServiceClient } from '@/lib/tenant/admin'
import { getTenantContext } from '@/lib/tenant/server'
import { DEFAULT_BILLING, type BillingConfig } from '@/lib/tenant/types'

/**
 * Recordatorios automáticos de cuota.
 *
 * Dos disparadores, con alcance distinto:
 *   · Un admin desde el panel  → sólo SU sede.
 *   · El cron diario           → TODAS las sedes activas, una por una.
 *
 * Dos cosas que rompía la versión single-tenant:
 *
 *  1. Resolvía la audiencia sobre toda la base con service role, así que un
 *     admin de Lanús le mandaba recordatorios a los alumnos de Quilmes y de
 *     cualquier otra marca.
 *
 *  2. Los textos tenían "día 10" y "20% de recargo" escritos a mano. Con la
 *     lógica de cobro configurable por dojo, eso le mentía a cualquier sede con
 *     otras reglas. Ahora los mensajes se derivan de `dojos.billing`.
 */

type DojoForReminder = {
    id: string
    name: string
    billing: BillingConfig
}

/** Días del mes en que se avisa, leídos de la config de notificaciones del dojo. */
type ReminderSettings = {
    day_10_enabled: boolean
    day_10_days: number[]
    expiry_enabled: boolean
    expiry_days: number[]
}

const DEFAULT_SETTINGS: ReminderSettings = {
    day_10_enabled: true,
    day_10_days: [8, 9, 10],
    expiry_enabled: true,
    expiry_days: [18, 19, 20],
}

/**
 * Arma el aviso con los NÚMEROS REALES del dojo. Devuelve null si hoy no
 * corresponde mandar nada en esa sede.
 */
function buildMessage(
    billing: BillingConfig,
    settings: ReminderSettings,
    day: number
): { title: string; message: string } | null {
    const tiers = [...(billing.tiers ?? [])].sort((a, b) => a.from_day - b.from_day)

    // Último día sin recargo, y el primer tramo que efectivamente bloquea.
    const freeTier = tiers.find((t) => t.surcharge_pct === 0)
    const blockingTier = tiers.find((t) => t.blocks_access)
    const firstCharged = tiers.find((t) => t.surcharge_pct > 0)

    if (settings.day_10_enabled && settings.day_10_days.includes(day)) {
        const limit = freeTier?.to_day
        const pct = firstCharged?.surcharge_pct

        return {
            title: '📢 ¡Evitá recargos!',
            message:
                limit && pct
                    ? `Acordate de abonar tu cuota antes del día ${limit} para evitar el ${pct}% de recargo. ¡Te esperamos!`
                    : 'Acordate de abonar tu cuota para mantener tu acceso al día. ¡Te esperamos!',
        }
    }

    if (settings.expiry_enabled && settings.expiry_days.includes(day)) {
        const blockDay = blockingTier?.from_day

        return {
            title: '⚠️ Tu pase está por vencer',
            message: blockDay
                ? `Últimos días para regularizar tu cuota. A partir del día ${blockDay} el acceso se bloquea automáticamente.`
                : 'Últimos días para regularizar tu cuota antes de que se bloquee el acceso.',
        }
    }

    return null
}

/** Procesa una sede: arma audiencia, manda push y devuelve el conteo. */
async function processDojo(
    supabase: ServiceClient,
    dojo: DojoForReminder,
    day: number,
    monthStart: string
) {
    const { data: rawSettings } = await supabase
        .from('notification_settings')
        .select('day_10_enabled, day_10_days, expiry_enabled, expiry_days')
        .eq('dojo_id', dojo.id)
        .maybeSingle()

    const settings: ReminderSettings = { ...DEFAULT_SETTINGS, ...(rawSettings ?? {}) }
    const copy = buildMessage(dojo.billing ?? DEFAULT_BILLING, settings, day)

    if (!copy) return { dojo: dojo.name, skipped: 'no corresponde hoy', sent: 0, targets: 0 }

    // Alumnos activos de ESTA sede (el staff no recibe avisos de deuda).
    const { data: candidates, error } = await supabase
        .from('members_with_status')
        .select('user_id')
        .eq('dojo_id', dojo.id)
        .eq('status', 'activo')
        .eq('role', 'member')

    if (error) throw error

    // Quiénes ya pagaron este mes EN ESTA SEDE.
    const { data: paid } = await supabase
        .from('payments')
        .select('user_id')
        .eq('dojo_id', dojo.id)
        .gte('paid_at', monthStart)

    const paidIds = new Set((paid ?? []).map((p) => p.user_id))
    const targets = (candidates ?? []).filter((c) => !paidIds.has(c.user_id))

    if (targets.length === 0) {
        return { dojo: dojo.name, skipped: 'todos al día', sent: 0, targets: 0 }
    }

    const payload = JSON.stringify({ title: copy.title, body: copy.message, url: '/profile' })

    const results = await Promise.all(
        targets.map(async (user) => {
            const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', user.user_id)

            if (!subs?.length) return 0

            let sent = 0
            for (const s of subs) {
                try {
                    await webpush.sendNotification(s.subscription as unknown as PushSubscription, payload)
                    sent++
                } catch (e: unknown) {
                    console.error(`[Reminders] fallo enviando a ${user.user_id}:`, e)
                    if (e instanceof WebPushError && (e.statusCode === 410 || e.statusCode === 404)) {
                        await supabase.from('push_subscriptions').delete().match({ subscription: s.subscription })
                    }
                }
            }
            return sent
        })
    )

    return {
        dojo: dojo.name,
        targets: targets.length,
        sent: results.reduce((a, b) => a + b, 0),
    }
}

export async function POST(req: Request) {
    // Alcance según quién dispara: el cron barre todas las sedes, el admin
    // sólo la suya.
    const cron = requireCronSecret(req)
    const isCron = !cron.error

    let scopedDojoId: string | null = null

    if (!isCron) {
        const ctx = await getTenantContext()
        const active = ctx?.activeDojo

        if (!active) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        if (!ctx.isPlatformAdmin && ctx.orgRole === null && active.role !== 'admin') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const featureGuard = await requireFeature('notifications')
        if (featureGuard.error) return featureGuard.error

        scopedDojoId = active.id
    }

    try {
        const supabase = serviceClient()

        const now = new Date()
        const body = await req.json().catch(() => ({}))
        const day: number = body.force_day || now.getDate()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

        const query = supabase.from('dojos').select('id, name, billing').eq('is_active', true)
        const { data: dojos } = scopedDojoId ? await query.eq('id', scopedDojoId) : await query

        if (!dojos?.length) {
            return NextResponse.json({ message: 'No hay sedes activas', day })
        }

        const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
        const SUBS_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@lotusclub.com'

        if (!PUBLIC_KEY || !PRIVATE_KEY) throw new Error('VAPID Keys missing')

        webpush.setVapidDetails(SUBS_SUBJECT, PUBLIC_KEY, PRIVATE_KEY)

        const perDojo = []
        for (const d of dojos as DojoForReminder[]) {
            perDojo.push(await processDojo(supabase, d, day, monthStart))
        }

        return NextResponse.json({
            success: true,
            day,
            scope: isCron ? 'todas las sedes' : 'sede activa',
            results: perDojo,
            notifications_sent: perDojo.reduce((a, r) => a + r.sent, 0),
        })
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error('[Reminders] Error:', e)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
