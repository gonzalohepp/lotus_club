'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function usePushNotifications() {
    const [isSupported] = useState(typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)

    useEffect(() => {
        if (!isSupported) return

        let mounted = true
        // Registramos directo, sin esperar a `serviceWorker.ready`: ese promise
        // solo resuelve cuando YA hay un worker activo, así que en un browser
        // sin registro previo (primera visita) nunca resolvía y el registro
        // quedaba trabado para siempre — el botón de activar no hacía nada.
        navigator.serviceWorker.register('/sw.js')
            .then(async (registration) => {
                const sub = await registration.pushManager.getSubscription()
                if (mounted) setSubscription(sub)
            })
            .catch((err) => console.error('SW registration failed:', err))

        return () => { mounted = false }
    }, [isSupported])

    const subscribeUser = useCallback(async (vapidPublicKey: string) => {
        try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey
            })

            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Remove any old subscriptions for THIS same endpoint to keep it clean
                // The DB unique constraint will also catch this, but upsert is better
                await supabase.from('push_subscriptions').upsert({
                    user_id: user.id,
                    subscription: sub.toJSON(),
                    endpoint: sub.endpoint
                }, { onConflict: 'endpoint' })
            }

            setSubscription(sub)
            return sub
        } catch (err) {
            console.error('Failed to subscribe:', err)
            return null
        }
    }, [])

    const unsubscribeUser = useCallback(async () => {
        try {
            if (subscription) {
                await subscription.unsubscribe()
                await supabase.from('push_subscriptions').delete().match({ endpoint: subscription.endpoint })
                setSubscription(null)
                return true
            }
            return false
        } catch (err) {
            console.error('Failed to unsubscribe:', err)
            return false
        }
    }, [subscription])

    return { isSupported, subscription, subscribeUser, unsubscribeUser }
}
