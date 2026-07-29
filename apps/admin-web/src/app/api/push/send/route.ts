import { NextResponse } from 'next/server'
import webpush, { WebPushError, type PushSubscription } from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '@/lib/requireCronSecret'

export async function POST(req: Request) {
    const guard = requireCronSecret(req)
    if (guard.error) return guard.error

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const bodyData = await req.json()
        console.log('[PushAPI] Received Request:', JSON.stringify(bodyData))

        // Support either direct call or Supabase Webhook payload
        const payload_data = bodyData.record ? bodyData.record : bodyData
        const { user_id, title, body, url } = payload_data

        if (!user_id) {
            console.warn('[PushAPI] Missing user_id')
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
        }

        // Fetch subscriptions for the user
        const { data: subs, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', user_id)

        if (subError) {
            console.error('[PushAPI] Supabase Error:', subError)
            throw subError
        }

        console.log(`[PushAPI] Found ${subs?.length || 0} subscriptions for user ${user_id}`)

        if (!subs || subs.length === 0) {
            return NextResponse.json({ message: 'No subscriptions found for this user' })
        }

        // Sin fallback: la clave que había acá era de otro proyecto, y usarla
        // producía suscripciones que nunca iban a recibir nada.
        const rawPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const rawPrivateKey = process.env.VAPID_PRIVATE_KEY || process.env.NEXT_PUBLIC_VAPID_PRIVATE_KEY
        const rawSubject = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_VAPID_SUBJECT || 'mailto:soporte@lotusclub.com'

        const publicKey = rawPublicKey?.trim()
        const privateKey = rawPrivateKey?.trim()
        const subject = rawSubject?.trim()

        // Diagnostic: List all env var names starting with VAPID or NEXT_PUBLIC_VAPID
        const availableKeys = Object.keys(process.env).filter(k => k.includes('VAPID'))
        console.log('[PushAPI] Environment Check (Keys only):', availableKeys)

        console.log('[PushAPI] VAPID Debug:', {
            hasPublic: !!publicKey,
            publicLength: publicKey?.length || 0,
            hasPrivate: !!privateKey,
            privateLength: privateKey?.length || 0,
            subject
        })

        if (!publicKey || !privateKey) {
            console.error('[PushAPI] Missing critical configuration. Private Key is required.')
            return NextResponse.json({
                error: 'Server VAPID configuration missing (Private Key)',
                detectedVapidKeys: availableKeys
            }, { status: 500 })
        }

        try {
            webpush.setVapidDetails(subject, publicKey, privateKey)
        } catch (setErr: unknown) {
            const message = setErr instanceof Error ? setErr.message : 'Unknown error'
            console.error('[PushAPI] setVapidDetails failed:', message)
            throw setErr
        }

        const payload = JSON.stringify({
            title: title || 'Notificación',
            body: body || 'Tienes un nuevo aviso del Dojo.',
            url: url || '/'
        })

        const sendPromises = subs.map((s: { subscription: unknown }) =>
            webpush.sendNotification(s.subscription as unknown as PushSubscription, payload)
                .then(() => console.log('[PushAPI] Notification sent successfully'))
                .catch(async (err: unknown) => {
                    console.error('[PushAPI] Error sending notification:', err)
                    if (err instanceof WebPushError && (err.statusCode === 410 || err.statusCode === 404)) {
                        console.log('[PushAPI] Cleaning up expired subscription')
                        // Cleanup expired subscription
                        await supabase
                            .from('push_subscriptions')
                            .delete()
                            .match({ subscription: s.subscription })
                    }
                })
        )

        await Promise.all(sendPromises)

        return NextResponse.json({ success: true, count: subs.length })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Push Error:', error)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
