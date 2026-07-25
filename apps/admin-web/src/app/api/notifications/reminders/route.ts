import { NextResponse } from 'next/server'
import webpush, { WebPushError, type PushSubscription } from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, requireFeature } from '@/lib/requireAdmin'
import { requireCronSecret } from '@/lib/requireCronSecret'

export async function POST(req: Request) {
    // Este endpoint lo puede disparar un admin logueado desde el panel (botón
    // "probar recordatorios") o un cron externo diario con el CRON_SECRET.
    const admin = await requireAdmin()
    if (admin.error) {
        const cron = requireCronSecret(req)
        if (cron.error) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
    }

    const featureGuard = requireFeature('notifications')
    if (featureGuard.error) return featureGuard.error

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 1. Get Settings from DB
        const { data: settings } = await supabase
            .from('notification_settings')
            .select('*')
            .eq('id', 'reminders')
            .single()

        // 2. Get current date details
        const now = new Date()
        const day = now.getDate() // 1-31

        const body = await req.json().catch(() => ({}))
        const checkDay = body.force_day || day

        console.log(`[Reminders] Running check for day: ${checkDay}`)

        let title = ''
        let message = ''
        let shouldSend = false

        // Logic A: Day 10 Reminder (Surcharge Warning)
        const day10Enabled = settings?.day_10_enabled ?? true
        const day10Days = settings?.day_10_days ?? [8, 9, 10]

        if (day10Enabled && day10Days.includes(checkDay)) {
            title = '📢 ¡Evita Recargos!'
            message = 'Recuerda abonar tu cuota antes del día 10 para evitar el 20% de recargo. ¡Te esperamos en el Dojo!'
            shouldSend = true
        }

        // Logic B: Expiry Warning
        const expiryEnabled = settings?.expiry_enabled ?? true
        const expiryDays = settings?.expiry_days ?? [18, 19, 20]

        if (expiryEnabled && expiryDays.includes(checkDay)) {
            title = '⚠️ Tu pase está por vencer'
            message = 'Últimos días para regularizar tu cuota. A partir del día 21 el acceso se bloqueará automáticamente.'
            shouldSend = true
        }

        if (!shouldSend) {
            return NextResponse.json({
                message: 'No reminders scheduled for today.',
                day: checkDay,
                settings: { day10Enabled, day10Days, expiryEnabled, expiryDays }
            })
        }

        // 2. Find Target Audience: Active Members who haven't paid this month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

        // Fetch ONLY active members (exclude admins/teachers from automatic debt reminders)
        const { data: candidates, error } = await supabase
            .from('members_with_status')
            .select('user_id, first_name')
            .eq('status', 'activo')
            .eq('role', 'member')

        if (error) throw error

        // Get users who HAVE paid this month (from payments table directly)
        const { data: paymentsThisMonth } = await supabase
            .from('payments')
            .select('user_id')
            .gte('paid_at', startOfMonth)

        const paidIds = new Set((paymentsThisMonth || []).map(p => p.user_id))

        // Filter out users who already paid
        const targets = (candidates || []).filter(c => !paidIds.has(c.user_id))

        console.log(`[Reminders] Found ${targets.length} unpaid active members out of ${candidates?.length || 0} total active.`)

        if (targets.length === 0) {
            return NextResponse.json({ message: 'Everyone is up to date!' })
        }

        // 3. Send Notifications using existing Push Logic (Internal)
        // We reuse the VAPID config from env
        const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
        const SUBS_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@beleza-dojo.com'

        if (!PUBLIC_KEY || !PRIVATE_KEY) throw new Error('VAPID Keys missing')

        webpush.setVapidDetails(SUBS_SUBJECT, PUBLIC_KEY, PRIVATE_KEY)

        // Batch processing
        const results = await Promise.all(targets.map(async (user) => {
            // Get sub
            const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', user.user_id)

            if (!subs || subs.length === 0) return 0;

            const payload = JSON.stringify({
                title,
                body: message,
                url: '/profile' // Direct them to their profile/payment info
            })

            let userSent = 0
            for (const s of subs) {
                try {
                    await webpush.sendNotification(s.subscription as unknown as PushSubscription, payload)
                    userSent++
                } catch (e: unknown) {
                    console.error(`Failed to send to ${user.user_id}:`, e)
                    if (e instanceof WebPushError && (e.statusCode === 410 || e.statusCode === 404)) {
                        await supabase.from('push_subscriptions').delete().match({ subscription: s.subscription })
                    }
                }
            }
            return userSent
        }))

        const totalSent = results.reduce((a, b) => a + b, 0)

        return NextResponse.json({
            success: true,
            day: checkDay,
            target_users: targets.length,
            notifications_sent: totalSent
        })

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error('[Reminders] Error:', e)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
