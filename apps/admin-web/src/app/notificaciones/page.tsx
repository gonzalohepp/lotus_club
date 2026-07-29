'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminLayout from '../layouts/AdminLayout'
import { fmtDateTime } from '@/lib/format'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'
import {
    Bell,
    Send,
    Users,
    Calendar,
    CheckCircle,
    Smartphone,
    History as HistoryIcon, // Renamed to avoid conflict with state variable
    Search,
    Trash2,
    Clock,
    Check,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { toast } from 'sonner'
import UserSearch from '../components/notifications/UserSearch'

interface NotificationHistoryItem {
    id: string
    title: string
    message: string
    target: string
    sent_at: string
    status: 'sent' | 'failed'
    count: number
}

type SubscriptionDevice = { id: string; subscription: { endpoint: string } }

type SubscribedUser = {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    avatar_url: string | null
    role?: string | null
    subscriptions?: SubscriptionDevice[]
}

export default function NotificationsPage() {
    // Historial y configuración de avisos son por sede: los días de recordatorio
    // dependen de la lógica de cobro, que cada dojo define por separado.
    const { activeDojo, branding, org } = useTenant()
    // La vista previa muestra el remitente real que verá el alumno.
    const marca = branding.display_name || org?.name || 'Tu dojo'
    const dojoId = activeDojo?.id

    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'send' | 'history' | 'config' | 'subscribed'>('send')
    const [selectedUser, setSelectedUser] = useState<SubscribedUser | null>(null)
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
    const [form, setForm] = useState<{
        target: 'all' | 'active' | 'expiring' | 'custom'
        title: string
        message: string
        url: string
    }>({
        target: 'all',
        title: '',
        message: '',
        url: '/'
    })

    const [history, setHistory] = useState<NotificationHistoryItem[]>([])
    const [subscribedUsers, setSubscribedUsers] = useState<SubscribedUser[]>([])
    const [settings, setSettings] = useState({
        day10Enabled: true,
        day10Days: '8, 9, 10',
        day10Time: '10:00',
        expiryEnabled: true,
        expiryDays: '18, 19, 20',
        expiryTime: '10:00'
    })

    useEffect(() => {
        const fetchData = async () => {
            const { supabase } = await import('@/lib/supabaseClient')

            // 1. Fetch History
            const { data: hist } = await supabase
                .from('notification_history')
                .select('*')
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .order('sent_at', { ascending: false })
                .limit(20)
            if (hist) setHistory(hist)

            // 2. Fetch Subscribed Users — sólo los de esta sede.
            // `push_subscriptions` es global (una suscripción es del navegador
            // de una persona, no de un dojo), así que el recorte se hace por el
            // padrón de la sede en vez de por una columna dojo_id.
            const { data: dojoMembers } = await supabase
                .from('dojo_members')
                .select('user_id')
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .eq('is_active', true)

            const memberIds = (dojoMembers ?? []).map((m) => m.user_id)

            const { data: subsData } = await supabase
                .from('push_subscriptions')
                .select('id, user_id, subscription, profiles!inner(*)')
                .in('user_id', memberIds)

            if (subsData) {
                // Group subscriptions by user_id
                const userMap = new Map()
                subsData.forEach(s => {
                    const uid = s.user_id
                    if (!userMap.has(uid)) {
                        userMap.set(uid, {
                            ...s.profiles,
                            subscriptions: []
                        })
                    }
                    userMap.get(uid).subscriptions.push({
                        id: s.id,
                        subscription: s.subscription
                    })
                })

                const uniqueUsers = Array.from(userMap.values())
                setSubscribedUsers(uniqueUsers)
            }

            // 3. Fetch Settings
            const { data: sett } = await supabase
                .from('notification_settings')
                .select('*')
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .maybeSingle()
            if (sett) {
                setSettings({
                    day10Enabled: sett.day_10_enabled,
                    day10Days: sett.day_10_days.join(', '),
                    day10Time: sett.day_10_time,
                    expiryEnabled: sett.expiry_enabled,
                    expiryDays: sett.expiry_days.join(', '),
                    expiryTime: sett.expiry_time
                })
            }
        }
        if (!dojoId) return
        fetchData()
    }, [dojoId])

    const saveSettings = async () => {
        const { supabase } = await import('@/lib/supabaseClient')
        const loadingToast = toast.loading('Guardando configuración...')

        try {
            const day10Arr = settings.day10Days.split(',').map((d: string) => parseInt(d.trim())).filter((d: number) => !isNaN(d))
            const expiryArr = settings.expiryDays.split(',').map((d: string) => parseInt(d.trim())).filter((d: number) => !isNaN(d))

            const { error } = await supabase
                .from('notification_settings')
                .upsert({
                    id: `reminders:${dojoId}`,
                    dojo_id: dojoId,
                    day_10_enabled: settings.day10Enabled,
                    day_10_days: day10Arr,
                    day_10_time: settings.day10Time,
                    expiry_enabled: settings.expiryEnabled,
                    expiry_days: expiryArr,
                    expiry_time: settings.expiryTime,
                    updated_at: new Date().toISOString()
                })

            if (error) throw error
            toast.success('Configuración guardada correctamente', { id: loadingToast })
        } catch {
            toast.error('Error al guardar configuración', { id: loadingToast })
        }
    }

    const deleteSubscription = async (id: string, userId: string) => {
        const { supabase } = await import('@/lib/supabaseClient')
        const loadingToast = toast.loading('Eliminando dispositivo...')

        try {
            const { error } = await supabase
                .from('push_subscriptions')
                .delete()
                .eq('id', id)

            if (error) throw error

            toast.success('Dispositivo eliminado', { id: loadingToast })

            // Update local state
            setSubscribedUsers(prev => prev.map(u => {
                if (u.user_id === userId) {
                    return {
                        ...u,
                        subscriptions: (u.subscriptions ?? []).filter((s) => s.id !== id)
                    }
                }
                return u
            }).filter(u => (u.subscriptions?.length ?? 0) > 0))

        } catch {
            toast.error('Error al eliminar dispositivo', { id: loadingToast })
        }
    }

    const handleSend = async () => {
        if (!form.title || !form.message) {
            toast.error('Debes completar título y mensaje')
            return
        }

        if (form.target === 'custom' && !selectedUser) {
            toast.error('Debes seleccionar un usuario')
            return
        }

        setLoading(true)
        const loadingToast = toast.loading('Enviando notificación...')

        try {
            const res = await fetch('/api/notifications/send-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target: form.target,
                    customUserId: selectedUser?.user_id,
                    title: form.title,
                    message: form.message,
                    url: form.url
                })
            })

            const data = await res.json()

            if (res.ok) {
                const toastMsg = data.userCount
                    ? `Notificación enviada a ${data.userCount} usuario${data.userCount > 1 ? 's' : ''} (${data.deviceCount} dispositivo${data.deviceCount > 1 ? 's' : ''})`
                    : `Notificación enviada`

                toast.success(toastMsg, { id: loadingToast })

                // Add to local history for visual feedback
                const newHistoryItem: NotificationHistoryItem = {
                    id: Math.random().toString(36).substr(2, 9),
                    title: form.title,
                    message: form.message,
                    target: form.target === 'all' ? 'Todos' : form.target === 'active' ? 'Activos' : form.target === 'expiring' ? 'A vencer' : `${selectedUser?.first_name} ${selectedUser?.last_name}`,
                    sent_at: new Date().toISOString(),
                    status: 'sent',
                    count: data.count || 1
                }
                setHistory([newHistoryItem, ...history])

                // Clear form
                setForm({ target: 'all', title: '', message: '', url: '/' })
                setSelectedUser(null)
            } else {
                toast.error(data.error || 'Error al enviar', { id: loadingToast })
            }
        } catch {
            toast.error('Error de conexión', { id: loadingToast })
        } finally {
            setLoading(false)
        }
    }

    const handleTestReminders = async () => {
        const loadingToast = toast.loading('Verificando recordatorios...')
        try {
            const res = await fetch('/api/notifications/reminders', { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                if (data.notifications_sent > 0) {
                    toast.success(`Se enviaron ${data.notifications_sent} recordatorios`, { id: loadingToast })
                } else {
                    toast.info('No hay recordatorios pendientes para hoy', { id: loadingToast })
                }
            } else {
                toast.info(data.message || 'Sin acciones para hoy', { id: loadingToast })
            }
        } catch {
            toast.error('Error al verificar recordatorios', { id: loadingToast })
        }
    }

    return (
        <AdminLayout active="/notificaciones">
            <div className="relative min-h-screen overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

                <div className="relative">
                    {/* Header */}
                    <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                                    Communications Hub
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                                Centro de <span className="text-blue-600 dark:text-blue-400">Notificaciones</span>
                            </h1>
                        </div>

                        {/* Tabs */}
                        <div className="flex p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <button
                                onClick={() => setActiveTab('send')}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'send'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Enviar
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Historial
                            </button>
                            <button
                                onClick={() => setActiveTab('subscribed')}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'subscribed'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Suscritos
                            </button>
                            <button
                                onClick={() => setActiveTab('config')}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'config'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Configuración
                            </button>
                        </div>
                    </header>

                    <AnimatePresence mode="wait">
                        {activeTab === 'send' ? (
                            <motion.div
                                key="send-tab"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="max-w-5xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start"
                            >
                                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl p-8 space-y-8">
                                    {/* Destinatario */}
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">¿A quién le enviamos?</label>
                                        <div className="flex flex-wrap gap-2">
                                            {([
                                                { id: 'all', label: 'Todos', icon: Users },
                                                { id: 'active', label: 'Activos', icon: CheckCircle },
                                                { id: 'expiring', label: 'Vencen pronto', icon: Clock },
                                                { id: 'custom', label: 'Una persona', icon: Search }
                                            ] as const).map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setForm({ ...form, target: opt.id })}
                                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${form.target === opt.id
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400'}`}
                                                >
                                                    <opt.icon className="w-4 h-4" />
                                                    <span className="text-xs font-black uppercase tracking-tight">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <AnimatePresence>
                                            {form.target === 'custom' && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="mt-4"
                                                >
                                                    <UserSearch onSelect={setSelectedUser} selectedUser={selectedUser} />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Mensaje */}
                                    <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2 mt-6">Título</label>
                                            <input
                                                type="text"
                                                value={form.title}
                                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                                placeholder="Ej: Nueva clase disponible"
                                                className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Mensaje</label>
                                            <textarea
                                                value={form.message}
                                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                                placeholder="Escribe el mensaje..."
                                                rows={3}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            />
                                        </div>

                                        <details className="group">
                                            <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors list-none flex items-center gap-1.5">
                                                <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                                                Opciones avanzadas (URL de destino)
                                            </summary>
                                            <input
                                                type="text"
                                                value={form.url}
                                                onChange={(e) => setForm({ ...form, url: e.target.value })}
                                                placeholder="/profile"
                                                className="w-full h-11 mt-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </details>
                                    </div>

                                    {/* Enviar */}
                                    <button
                                        onClick={handleSend}
                                        disabled={loading}
                                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Enviar notificación
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Columna derecha: preview en vivo + alcance (sticky en desktop) */}
                                <div className="lg:sticky lg:top-6 space-y-4">
                                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl p-6">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Vista previa</p>
                                        <div className="rounded-3xl bg-slate-100 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-start gap-3 rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-lg">
                                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                                                    <Bell className="w-5 h-5 text-white" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{marca}</p>
                                                        <span className="text-[9px] font-bold text-slate-400 shrink-0">ahora</span>
                                                    </div>
                                                    <h5 className="text-sm font-black text-slate-900 dark:text-white leading-tight mt-0.5 break-words">
                                                        {form.title || 'Título de la notificación'}
                                                    </h5>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5 line-clamp-4 break-words">
                                                        {form.message || 'Escribí un mensaje para ver la vista previa acá.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setActiveTab('subscribed')}
                                        className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-left"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                            <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{subscribedUsers.length}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Usuarios suscritos</p>
                                        </div>
                                    </button>
                                </div>
                            </motion.div>
                        ) : activeTab === 'history' ? (
                            <motion.div
                                key="history-tab"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="max-w-4xl mx-auto"
                            >
                                {/* ... existing history content ... */}
                                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
                                    <div className="p-8 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                                                <HistoryIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Registro de Envíos</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Historial de las últimas notificaciones</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {history.length === 0 ? (
                                            <div className="p-20 text-center">
                                                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                                                    <Bell className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                                                </div>
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No se han enviado notificaciones aún</p>
                                            </div>
                                        ) : (
                                            history.map((item) => (
                                                <div key={item.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group">
                                                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md">
                                                                    Para: {item.target}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400">
                                                                    {fmtDateTime(item.sent_at)}
                                                                </span>
                                                            </div>
                                                            <h4 className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{item.title}</h4>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{item.message}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                                            <Users className="w-4 h-4 text-slate-400" />
                                                            <span className="text-sm font-black text-slate-700 dark:text-slate-300">{item.count}</span>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase">Impactos</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ) : activeTab === 'config' ? (
                            <motion.div
                                key="config-tab"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="max-w-4xl mx-auto"
                            >
                                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden p-8">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                                            <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Configuración Automática</h3>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Define cuándo y cómo se envían los recordatorios</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Day 10 Section */}
                                        <div className="space-y-6 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-black text-slate-900 dark:text-white">Recordatorio Día 10</h4>
                                                <button
                                                    onClick={() => setSettings({ ...settings, day10Enabled: !settings.day10Enabled })}
                                                    className={`w-12 h-6 rounded-full transition-colors relative ${settings.day10Enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.day10Enabled ? 'right-1' : 'left-1'}`} />
                                                </button>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Días del mes (separados por coma)</label>
                                                    <input
                                                        type="text"
                                                        value={settings.day10Days}
                                                        onChange={(e) => setSettings({ ...settings, day10Days: e.target.value })}
                                                        className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Hora de envío</label>
                                                    <input
                                                        type="time"
                                                        value={settings.day10Time}
                                                        onChange={(e) => setSettings({ ...settings, day10Time: e.target.value })}
                                                        className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expiry Section */}
                                        <div className="space-y-6 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-black text-slate-900 dark:text-white">Alerta Vencimiento</h4>
                                                <button
                                                    onClick={() => setSettings({ ...settings, expiryEnabled: !settings.expiryEnabled })}
                                                    className={`w-12 h-6 rounded-full transition-colors relative ${settings.expiryEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.expiryEnabled ? 'right-1' : 'left-1'}`} />
                                                </button>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Días del mes (separados por coma)</label>
                                                    <input
                                                        type="text"
                                                        value={settings.expiryDays}
                                                        onChange={(e) => setSettings({ ...settings, expiryDays: e.target.value })}
                                                        className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Hora de envío</label>
                                                    <input
                                                        type="time"
                                                        value={settings.expiryTime}
                                                        onChange={(e) => setSettings({ ...settings, expiryTime: e.target.value })}
                                                        className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <button
                                            onClick={handleTestReminders}
                                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-all"
                                        >
                                            <Bell className="w-4 h-4" /> Probar ahora
                                        </button>
                                        <button
                                            onClick={saveSettings}
                                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Guardar Cambios
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="subscribed-tab"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
                            >
                                <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Usuarios Suscritos</h3>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Estos usuarios han habilitado las notificaciones en sus dispositivos</p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/30 px-6 py-3 rounded-2xl border border-blue-100 dark:border-blue-800">
                                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{subscribedUsers.length}</span>
                                        <span className="ml-2 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest">Activos</span>
                                    </div>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {subscribedUsers.length === 0 ? (
                                        <div className="col-span-full py-20 text-center">
                                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                                                <Smartphone className="w-10 h-10 text-slate-400" />
                                            </div>
                                            <p className="text-slate-500 font-black text-xs uppercase tracking-[0.2em]">No hay usuarios con suscripciones activas</p>
                                        </div>
                                    ) : (
                                        subscribedUsers.map((user) => (
                                            <div
                                                key={user.user_id}
                                                className="flex flex-col gap-2"
                                            >
                                                <div
                                                    className="group flex items-center gap-4 p-5 rounded-[2.2rem] border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all cursor-pointer relative overflow-hidden"
                                                    onClick={() => {
                                                        setSelectedUser(user)
                                                        setForm({ ...form, target: 'custom' })
                                                        setActiveTab('send')
                                                        toast.success(`Elegido: ${user.first_name}`)
                                                    }}
                                                >
                                                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
                                                            <Check className="w-3 h-3" />
                                                        </div>
                                                    </div>

                                                    <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center font-black text-blue-600 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-300">
                                                        {(user.first_name?.[0] || '') + (user.last_name?.[0] || '')}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                                                                {user.first_name} {user.last_name}
                                                            </h4>
                                                            {user.role === 'admin' && (
                                                                <span className="text-[8px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">Admin</span>
                                                            )}
                                                            {user.role === 'instructor' && (
                                                                <span className="text-[8px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">Instructor</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 font-bold truncate uppercase tracking-tighter mt-0.5">
                                                            {user.email}
                                                        </p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setExpandedUserId(expandedUserId === user.user_id ? null : user.user_id)
                                                    }}
                                                    className={`mx-6 flex items-center justify-center gap-2 py-1.5 rounded-b-2xl border-x border-b transition-all text-[10px] font-black uppercase tracking-widest ${expandedUserId === user.user_id
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 hover:text-blue-600'}`}
                                                >
                                                    {user.subscriptions?.length || 0} dispositivos {expandedUserId === user.user_id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button>

                                                <AnimatePresence>
                                                    {expandedUserId === user.user_id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mx-6 overflow-hidden"
                                                        >
                                                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 mt-1 shadow-inner">
                                                                {user.subscriptions?.map((sub, idx: number) => (
                                                                    <div key={sub.id} className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                                                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <p className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                                                                                    Disp. #{idx + 1}
                                                                                </p>
                                                                                <p className="text-[8px] font-bold text-slate-500 truncate font-mono">
                                                                                    {sub.subscription.endpoint.split('/').pop()?.substring(0, 20)}...
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => deleteSubscription(sub.id, user.user_id)}
                                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                                            title="Eliminar dispositivo"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </AdminLayout>
    )
}
