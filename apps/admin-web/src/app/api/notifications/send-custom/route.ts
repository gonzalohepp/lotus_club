import { NextResponse } from 'next/server'
import webpush, { WebPushError, type PushSubscription } from 'web-push'
import { requireFeature } from '@/lib/requireAdmin'
import { requireDojoManager } from '@/lib/tenant/server'
import { assertMemberOfDojo, serviceClient } from '@/lib/tenant/admin'

/**
 * Envío manual de notificaciones push a los alumnos de LA SEDE ACTIVA.
 *
 * ⚠️ Esta ruta corre con service role, que ignora RLS. Antes resolvía las
 * audiencias ("todos", "activos", "por vencer") sobre TODA la base, así que un
 * admin de Lotus Lanús le mandaba push a los alumnos de Quilmes y de cualquier
 * otra marca de la plataforma. Todas las queries de audiencia van scopeadas
 * por `dojo_id`, y el target `custom` valida que esa persona sea de la sede.
 */
export async function POST(req: Request) {
    const guard = await requireDojoManager()
    if (guard.error) return guard.error

    const { dojoId } = guard

    const featureGuard = await requireFeature('notifications')
    if (featureGuard.error) return featureGuard.error

    try {
        const supabase = serviceClient()

        const body = await req.json()
        const { target, customUserId, title, message, url } = body

        console.log('[Custom Notification] Request received:', { target, customUserId, title, url })

        if (!title || !message) {
            return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
        }

        let targetUserIds: string[] = []

        if (target === 'custom') {
            if (!customUserId) {
                return NextResponse.json({ error: 'User ID required for custom target' }, { status: 400 })
            }
            // Sin esto se le podría mandar un push a cualquier persona de la
            // plataforma pasando su user_id a mano.
            const belongs = await assertMemberOfDojo(supabase, dojoId, customUserId)
            if ('error' in belongs) return belongs.error

            targetUserIds = [customUserId]
        } else if (target === 'all') {
            const { data, error } = await supabase
                .from('dojo_members')
                .select('user_id')
                .eq('dojo_id', dojoId)
                .eq('is_active', true)
                .in('role', ['member', 'becado'])

            console.log('[Custom Notification] "all" query result:', { count: data?.length, error })
            targetUserIds = (data || []).map(p => p.user_id)
        } else if (target === 'active') {
            const { data } = await supabase
                .from('members_with_status')
                .select('user_id')
                .eq('dojo_id', dojoId)
                .eq('status', 'activo')
                .eq('role', 'member')
            targetUserIds = (data || []).map(p => p.user_id)
        } else if (target === 'expiring') {
            const today = new Date().toISOString().slice(0, 10)
            const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            const { data } = await supabase
                .from('memberships')
                .select('member_id')
                .eq('dojo_id', dojoId)
                .gte('end_date', today)
                .lte('end_date', sevenDaysLater)

            targetUserIds = (data || []).map(m => m.member_id)
        }

        console.log(`[Custom Notification] Targeting ${targetUserIds.length} users for target="${target}"`)

        if (targetUserIds.length === 0) {
            return NextResponse.json({
                message: 'No users found for this target',
                count: 0,
                target,
                debug: target === 'all' ? 'Try checking if users have role="member" in profiles table' : ''
            })
        }

        const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
        const SUBS_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@lotusclub.com'

        if (!PUBLIC_KEY || !PRIVATE_KEY) {
            return NextResponse.json({ error: 'Push service not configured' }, { status: 500 })
        }

        webpush.setVapidDetails(SUBS_SUBJECT, PUBLIC_KEY, PRIVATE_KEY)

        let devicesReached = 0
        const usersReached = new Set<string>()

        await Promise.all(targetUserIds.map(async (uid) => {
            const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', uid)

            if (!subs || subs.length === 0) return 0

            let userDevices = 0
            const payload = JSON.stringify({
                title,
                body: message,
                url: url || '/'
            })

            for (const s of subs) {
                try {
                    await webpush.sendNotification(s.subscription as unknown as PushSubscription, payload)
                    userDevices++
                    devicesReached++
                    usersReached.add(uid)
                } catch (e: unknown) {
                    console.error(`Error sending to ${uid}:`, e)
                    if (e instanceof WebPushError && (e.statusCode === 410 || e.statusCode === 404)) {
                        await supabase.from('push_subscriptions').delete().match({ subscription: s.subscription })
                    }
                }
            }
            return userDevices
        }))

        try {
            await supabase.from('notification_history').insert({
                dojo_id: dojoId,
                title,
                message,
                target,
                status: 'sent',
                count: usersReached.size
            })
        } catch (err) {
            console.error('Error saving history:', err)
        }

        return NextResponse.json({
            success: true,
            userCount: usersReached.size,
            deviceCount: devicesReached,
            count: usersReached.size
        })

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error('[Custom Notification] Error:', e)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
