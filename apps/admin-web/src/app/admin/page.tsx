'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { fmtARS } from '@/lib/format'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'
import AdminLayout from '../layouts/AdminLayout'
import StatsCard from '../components/dashboard/StatsCard'
import RecentActivity from '../components/dashboard/RecentActivity'
import ExpiringMembers from '../components/dashboard/ExpiringMembers'
import RecentAccess from '../components/dashboard/RecentAccess'
import { Users, UserCheck, UserX, DollarSign, ClipboardCheck, Plus, Clock, ArrowRight, Activity } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'


type Stats = {
  members_total: number
  members_active: number
  members_inactive: number
  accesses_success_today: number
  accesses_denied_today: number
  revenue_this_month: number | null
  expiring_next_7d:
  | { user_id: string; first_name: string | null; last_name: string | null; end_date: string }[]
  | null
  paid_on_time: number
  paid_late_1: number
  paid_late_2: number
}

type PayRow = {
  amount: number
  method: string | null
  paid_at: string
  profiles?: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null
}

type AccessRow = {
  scanned_at: string
  result: 'authorized' | 'denied' | 'unknown'
  reason: string | null
  profiles?: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null
}

function normalizeResult(value: string | null | undefined): 'authorized' | 'denied' | 'unknown' {
  const v = (value ?? '').trim().toLowerCase()
  if (['autorizado', 'authorized', 'ok', 'success', 'permitido', 'allow'].includes(v)) return 'authorized'
  if (['denegado', 'denied', 'reject', 'rejected'].includes(v)) return 'denied'
  return 'unknown'
}

export default function AdminDashboard() {
  // `can` refleja el plan de la organización dueña del dojo activo.
  const { can, activeDojo } = useTenant()
  // `dashboard_stats` ahora devuelve UNA FILA POR DOJO. Sin el filtro, el
  // .maybeSingle() de abajo falla apenas exista una segunda sede.
  const dojoId = activeDojo?.id
  const [stats, setStats] = useState<Stats | null>(null)
  const [payments, setPayments] = useState<PayRow[]>([])
  const [access, setAccess] = useState<AccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [
        { data: s, error: se },
        { data: p, error: pe },
        { data: a, error: ae },
      ] = await Promise.all([
        supabase.from('dashboard_stats').select('*').eq('dojo_id', dojoId ?? NO_DOJO).maybeSingle(),
        can('payments')
          ? supabase
            .from('payments')
            .select('amount, method, paid_at, profiles!payments_user_id_fkey(first_name,last_name,avatar_url)')
            .eq('dojo_id', dojoId ?? NO_DOJO)
            .order('paid_at', { ascending: false })
            .limit(5)
          : Promise.resolve({ data: [] as PayRow[], error: null }),
        supabase
          .from('access_logs')
          .select('scanned_at, result, reason, profiles!access_logs_user_id_fkey(first_name,last_name,avatar_url)')
          .eq('dojo_id', dojoId ?? NO_DOJO)
          .order('scanned_at', { ascending: false })
          .limit(10),
      ])

      if (se) throw se
      if (pe) throw pe
      if (ae) throw ae

      setStats(s as Stats)

      const mappedPayments = (p ?? []).map((r) => {
        const row = r as {
          amount: number
          method: string | null
          paid_at: string
          profiles: Record<string, unknown> | Record<string, unknown>[] | null
        }
        return {
          ...row,
          profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        }
      }) as PayRow[]
      setPayments(mappedPayments)

      const normalized = (a ?? []).map((row) => {
        const r = row as {
          scanned_at: string
          result: string | null
          reason: string | null
          profiles: Record<string, unknown> | Record<string, unknown>[] | null
        }
        return {
          ...r,
          profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
          result: normalizeResult(r.result),
        }
      }) as AccessRow[]
      setAccess(normalized)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error cargando dashboard'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!dojoId) return

    fetchData()

    // Real-time Subscriptions
    const accessChannel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'access_logs' },
        () => {
          console.debug('[Realtime] Access log change detected')
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => {
          console.debug('[Realtime] Payment change detected')
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(accessChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dojoId])

  // Fallback por si revenue_this_month viniera null en la vista (no debería).
  const monthRevenue = useMemo(() => {
    if (stats?.revenue_this_month != null) return Number(stats.revenue_this_month) || 0
    const now = new Date()
    return payments
      .filter((p) => {
        const d = new Date(p.paid_at)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((acc, p) => acc + Number(p.amount || 0), 0)
  }, [stats?.revenue_this_month, payments])

  return (
    <AdminLayout active="/admin">
      <div className="relative min-h-screen">
        <div>
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 pb-8 border-b border-slate-200 dark:border-white/10">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-2">
                Dashboard general
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                Actualizado en tiempo real • {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/members" className="flex-1 md:flex-none">
                <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand text-white font-semibold active:scale-95 transition-all hover:bg-brand-dark">
                  <Plus className="w-5 h-5" />
                  Nuevo Miembro
                </button>
              </Link>
              {can('payments') && (
                <Link href="/payments" className="flex-1 md:flex-none">
                  <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95">
                    <DollarSign className="w-4 h-4" />
                    Pago
                  </button>
                </Link>
              )}
            </div>
          </header>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 mb-8 text-red-700 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0 font-bold">!</div>
              Error: {error}
            </motion.div>
          )}

          {/* KPIs */}
          <section className={can('payments') ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10'}>
            <StatsCard
              title="Total Miembros"
              value={stats?.members_total ?? 0}
              icon={<Users className="w-5 h-5" />}
              color="blue"
              loading={loading}
            />
            <StatsCard
              title="Activos"
              value={stats?.members_active ?? 0}
              icon={<UserCheck className="w-5 h-5" />}
              color="green"
              loading={loading}
            />
            <StatsCard
              title="Vencidos"
              value={stats?.members_inactive ?? 0}
              icon={<UserX className="w-5 h-5" />}
              color="red"
              loading={loading}
            />
            {can('payments') && (
              <StatsCard
                title="Ingresos del Mes"
                value={fmtARS(monthRevenue)}
                icon={<DollarSign className="w-5 h-5" />}
                color="purple"
                loading={loading}
              />
            )}
            <StatsCard
              title="Accesos Hoy"
              value={(stats?.accesses_success_today ?? 0) + (stats?.accesses_denied_today ?? 0)}
              icon={<ClipboardCheck className="w-5 h-5" />}
              color="blue"
              loading={loading}
            />
          </section>



          {/* Activity Section */}
          <div className={can('payments') ? 'grid lg:grid-cols-3 gap-8 mb-10' : 'grid gap-8 mb-10'}>
            {can('payments') && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Activity className="w-5 h-5 text-brand" />
                    Pagos recientes
                  </h2>
                  <Link href="/payments" className="text-sm font-semibold text-brand-dark dark:text-brand hover:underline flex items-center gap-1">
                    Ver todos <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  <RecentActivity rows={payments} loading={loading} />
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              <h2 className="text-lg font-bold text-rose-500 tracking-tight flex items-center gap-2">
                <UserX className="w-5 h-5" />
                Próximos vencimientos
              </h2>
              <ExpiringMembers rows={stats?.expiring_next_7d ?? []} loading={loading} />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-brand" />
                Historial de accesos
              </h2>
              <Link href="/access-log" className="text-sm font-semibold text-brand-dark dark:text-brand hover:underline flex items-center gap-1">
                Ver historial completo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <RecentAccess rows={access} loading={loading} />
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  )
}
