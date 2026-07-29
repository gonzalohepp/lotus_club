import { NextResponse } from 'next/server'
import webpush, { WebPushError, type PushSubscription } from 'web-push'
import { requireCronSecret } from '@/lib/requireCronSecret'
import { serviceClient } from '@/lib/tenant/admin'

/**
 * Aviso de acceso denegado. Lo dispara un webhook de Supabase al insertarse una
 * fila en `access_logs`, así que el `record` que llega ya trae el `dojo_id` de
 * la sede donde se hizo el scan.
 *
 * Dos cosas que rompía la versión single-tenant:
 *   · El chequeo de fraude contaba los rechazos del alumno en TODA la base, así
 *     que tres intentos repartidos entre dos sedes disparaban una alerta falsa.
 *   · Buscaba a quién notificar con `profiles.role = 'admin'`, el rol GLOBAL
 *     heredado. Resultado: un rechazo en Lanús le llegaba también a los
 *     administradores de Quilmes y de cualquier otra marca.
 */
export async function POST(req: Request) {
    const guard = requireCronSecret(req)
    if (guard.error) return guard.error

    try {
        const supabase = serviceClient()

        const bodyData = await req.json()
        const record = bodyData.record || bodyData
        const dojoId: string | undefined = record.dojo_id ?? undefined

        // 1. Validate it's a denial
        if (record.result !== 'denegado' && record.result !== 'denied') {
            return NextResponse.json({ message: 'Not a denial, skipping' })
        }

        // 2. Get Member Name and Check for Fraud
        let memberName = 'Usuario'
        let isFraudAttempt = false
        if (record.user_id) {
            const { data: p } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', record.user_id)
                .maybeSingle()
            if (p) memberName = `${p.first_name} ${p.last_name}`

            // Fraud Check: 3 denied logs in 5 minutes
            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
            const fraudQuery = supabase
                .from('access_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', record.user_id)
                .eq('result', 'denegado')
                .gt('scanned_at', fiveMinsAgo)

            // El patrón sospechoso es insistir en LA MISMA puerta. Tres intentos
            // repartidos entre dos sedes no son un fraude.
            const { count } = dojoId ? await fraudQuery.eq('dojo_id', dojoId) : await fraudQuery

            if (count && count >= 3) {
                isFraudAttempt = true
            }
        }

        // 3. A quién avisar: el staff de LA SEDE donde ocurrió el rechazo.
        if (!dojoId) {
            console.warn('[security-alert] access_log sin dojo_id, no se puede determinar a quién avisar')
            return NextResponse.json({ message: 'No dojo_id in record, skipping' })
        }

        const { data: admins } = await supabase
            .from('dojo_members')
            .select('user_id')
            .eq('dojo_id', dojoId)
            .eq('is_active', true)
            .in('role', ['admin', 'instructor'])

        if (!admins || admins.length === 0) {
            return NextResponse.json({ message: 'No admins found to notify' })
        }

        const adminIds = admins.map(a => a.user_id)

        // 4. Setup VAPID
        const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@beleza-dojo.com',
            PUBLIC_KEY!,
            PRIVATE_KEY!
        )

        const payload = JSON.stringify({
            title: isFraudAttempt ? '⚠️ ALERTA DE SEGURIDAD' : '🚩 Alerta de Acceso',
            body: isFraudAttempt
                ? `REPETIDAS NEGATIVAS: ${memberName} ha fallado múltiples intentos.`
                : `${memberName}: ${record.reason || 'Acceso denegado'}`,
            url: '/admin'
        })

        // 5. Send to all admins
        let totalSent = 0
        for (const adminId of adminIds) {
            const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', adminId)

            if (subs) {
                for (const s of subs) {
                    try {
                        await webpush.sendNotification(s.subscription as unknown as PushSubscription, payload)
                        totalSent++
                    } catch (e: unknown) {
                        if (e instanceof WebPushError && (e.statusCode === 410 || e.statusCode === 404)) {
                            await supabase.from('push_subscriptions').delete().match({ subscription: s.subscription })
                        }
                    }
                }
            }
        }

        return NextResponse.json({ success: true, admins_notified: adminIds.length, push_sent: totalSent })

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error('[Security Alert API] Error:', e)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
