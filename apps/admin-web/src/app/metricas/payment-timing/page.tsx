'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'
import AdminLayout from '../../layouts/AdminLayout'
import { CheckCircle, AlertTriangle, XCircle, Filter, Users } from 'lucide-react'
import type { ReactNode } from 'react'

type PaymentUser = {
    user_id: string
    first_name: string | null
    last_name: string | null
    amount: number
    paid_at: string
    day: number
}

type FilterType = 'all' | 'on_time' | 'late' | 'overdue'

export default function PaymentTimingPage() {
    // Timing de pagos de la sede activa: promediar dos sucursales con reglas de
    // cobro distintas daría un número sin significado.
    const { activeDojo } = useTenant()
    const dojoId = activeDojo?.id

    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<PaymentUser[]>([])
    const [filter, setFilter] = useState<FilterType>('all')

    useEffect(() => {
        const fetchPayments = async () => {
            setLoading(true)
            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

            const { data, error } = await supabase
                .from('payments')
                .select(`
          user_id,
          amount,
          paid_at,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .gte('paid_at', startOfMonth)
                .order('paid_at', { ascending: false })

            if (error) {
                console.error('Error fetching payments:', error)
                setLoading(false)
                return
            }

            type PaymentRaw = {
                user_id: string
                amount: number
                paid_at: string
                profiles: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
            }

            const mapped: PaymentUser[] = ((data || []) as PaymentRaw[]).map((p) => {
                const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
                return {
                    user_id: p.user_id,
                    first_name: profile?.first_name || null,
                    last_name: profile?.last_name || null,
                    amount: p.amount,
                    paid_at: p.paid_at,
                    day: new Date(p.paid_at).getDate()
                }
            })

            setUsers(mapped)
            setLoading(false)
        }

        fetchPayments()
    }, [dojoId])

    const counts = useMemo(() => {
        return {
            on_time: users.filter(u => u.day <= 10).length,
            late: users.filter(u => u.day > 10 && u.day <= 20).length,
            overdue: users.filter(u => u.day > 20).length
        }
    }, [users])

    const filteredUsers = useMemo(() => {
        if (filter === 'all') return users
        if (filter === 'on_time') return users.filter(u => u.day <= 10)
        if (filter === 'late') return users.filter(u => u.day > 10 && u.day <= 20)
        if (filter === 'overdue') return users.filter(u => u.day > 20)
        return users
    }, [users, filter])

    return (
        <AdminLayout active="/metricas">
            <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
                <div>
                    {/* Header */}
                    <header className="mb-10">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                Comportamiento de Pagos
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-none mb-3">
                            Análisis de <span className="text-emerald-600 dark:text-emerald-400">Puntualidad</span>
                        </h1>
                        <p className="text-slate-500 text-lg font-medium">
                            Seguimiento detallado de comportamiento de pago (mes actual)
                        </p>
                    </header>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        <KpiCard
                            title="A Término (1-10)"
                            count={counts.on_time}
                            icon={<CheckCircle className="w-6 h-6" />}
                            color="green"
                            loading={loading}
                        />
                        <KpiCard
                            title="Con Recargo (11-20)"
                            count={counts.late}
                            icon={<AlertTriangle className="w-6 h-6" />}
                            color="yellow"
                            loading={loading}
                        />
                        <KpiCard
                            title="Fuera de Término (> 20)"
                            count={counts.overdue}
                            icon={<XCircle className="w-6 h-6" />}
                            color="red"
                            loading={loading}
                        />
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex items-center gap-3 mb-6">
                        <Filter className="w-5 h-5 text-slate-400" />
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
                            <FilterButton
                                active={filter === 'all'}
                                onClick={() => setFilter('all')}
                                label="Todos"
                                count={users.length}
                            />
                            <FilterButton
                                active={filter === 'on_time'}
                                onClick={() => setFilter('on_time')}
                                label="A Término"
                                count={counts.on_time}
                                color="green"
                            />
                            <FilterButton
                                active={filter === 'late'}
                                onClick={() => setFilter('late')}
                                label="Con Recargo"
                                count={counts.late}
                                color="yellow"
                            />
                            <FilterButton
                                active={filter === 'overdue'}
                                onClick={() => setFilter('overdue')}
                                label="Fuera de Término"
                                count={counts.overdue}
                                color="red"
                            />
                        </div>
                    </div>

                    {/* User List */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-emerald-500" />
                                Listado de Usuarios ({filteredUsers.length})
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-slate-500">Usuario</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-slate-500">Fecha</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-slate-500">Día</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-slate-500">Monto</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-slate-500">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {loading && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                                                Cargando...
                                            </td>
                                        </tr>
                                    )}
                                    {!loading && filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                                                No hay pagos registrados en esta categoría
                                            </td>
                                        </tr>
                                    )}
                                    {!loading && filteredUsers.map((user) => (
                                        <tr key={`${user.user_id}-${user.paid_at}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900 dark:text-white">
                                                    {user.first_name} {user.last_name}
                                                </div>
                                                <div className="text-xs text-slate-400">#{user.user_id.slice(0, 8)}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                                {new Date(user.paid_at).toLocaleDateString('es-AR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-sm font-black">
                                                    {user.day}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                                ${user.amount.toLocaleString('es-AR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge day={user.day} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>
            </div>
        </AdminLayout>
    )
}

function KpiCard({ title, count, icon, color, loading }: { title: string; count: number; icon: ReactNode; color: 'green' | 'yellow' | 'red'; loading: boolean }) {
    const colors: Record<'green' | 'yellow' | 'red', string> = {
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
        yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
    }

    return (
        <motion.div
            whileHover={{ y: -4 }}
            className={`rounded-3xl border-2 p-6 shadow-lg ${colors[color]}`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-white/50 dark:bg-black/20">
                    {icon}
                </div>
                <div className="text-4xl font-black">
                    {loading ? '...' : count}
                </div>
            </div>
            <p className="text-xs font-black uppercase tracking-widest opacity-70">
                {title}
            </p>
        </motion.div>
    )
}

type FilterButtonColor = 'green' | 'yellow' | 'red' | 'blue'

function FilterButton({ active, onClick, label, count, color = 'blue' }: {
    active: boolean
    onClick: () => void
    label: string
    count?: number
    color?: FilterButtonColor
}) {
    const colorMap: Record<FilterButtonColor, string> = {
        green: active ? 'bg-green-500 text-white' : 'text-green-600 dark:text-green-400',
        yellow: active ? 'bg-yellow-500 text-white' : 'text-yellow-600 dark:text-yellow-400',
        red: active ? 'bg-red-500 text-white' : 'text-red-600 dark:text-red-400',
        blue: active ? 'bg-blue-500 text-white' : 'text-blue-600 dark:text-blue-400'
    }

    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${active ? colorMap[color] + ' shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
            {label} {count !== undefined && `(${count})`}
        </button>
    )
}

function StatusBadge({ day }: { day: number }) {
    if (day <= 10) {
        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-black">
                <CheckCircle className="w-3 h-3" />
                A Término
            </span>
        )
    }
    if (day <= 20) {
        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-black">
                <AlertTriangle className="w-3 h-3" />
                +20% Recargo
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-black">
            <XCircle className="w-3 h-3" />
            Fuera de Término
        </span>
    )
}
