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
  const { can, allows, activeDojo } = useTenant()

  /**
   * Para mostrar plata hacen falta las dos condiciones: que el PLAN incluya
   * pagos (`can`) y que el ROL pueda verlos (`allows`). Con sólo `can`, al head
   * coach le aparecían el tile de ingresos y la lista de pagos —vacíos por RLS,
   * pero visibles.
   */
  const showMoney = can('payments') && allows('viewFinance')
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
        showMoney
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

  /** Porcentaje de socios al día. Se muestra en el tile para no obligar al
   *  admin a comparar dos números de tarjetas distintas. */
  const activeRatio = useMemo(() => {
    const total = stats?.members_total ?? 0
    if (!total) return 0
    return Math.round(((stats?.members_active ?? 0) / total) * 100)
  }, [stats?.members_total, stats?.members_active])

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
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 pb-8 border-b border-carbon-200 dark:border-white/10">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
                Dashboard general
              </h1>
              <p className="text-carbon-500 dark:text-carbon-400 font-medium flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                Actualizado en tiempo real • {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              </p>
            </div>

            {/* CTA primario negro y secundario Palm Leaf, como define el manual.
                "Nuevo Miembro" es un atajo a un alta, así que sigue el mismo
                permiso que la pantalla a la que lleva: sin él, el Mestre veía
                acá el botón que ya no tiene en /members. */}
            <div className="flex flex-wrap gap-2">
              {allows('manageMembers') && (
                <Link href="/members" className="flex-1 md:flex-none">
                  <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#121113] dark:bg-[#F7F7F2] text-[#F7F7F2] dark:text-[#121113] font-bold active:scale-95 transition-all hover:brightness-150 dark:hover:brightness-95">
                    <Plus className="w-5 h-5" />
                    Nuevo Miembro
                  </button>
                </Link>
              )}
              {showMoney && (
                <Link href="/payments" className="flex-1 md:flex-none">
                  <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#899878] text-[#121113] font-bold hover:brightness-110 transition-all active:scale-95">
                    <DollarSign className="w-4 h-4" />
                    Registrar pago
                  </button>
                </Link>
              )}
            </div>
          </header>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 mb-8 text-alert-700 bg-alert-50 border border-alert-200 rounded-2xl flex items-center gap-3 font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-alert-100 flex items-center justify-center text-alert-600 flex-shrink-0 font-bold">!</div>
              Error: {error}
            </motion.div>
          )}

          {/* KPIs — con jerarquía: la plata del mes es el número que manda y
              ocupa el doble de ancho. Antes eran cinco tarjetas iguales, todas
              con el mismo peso visual. */}
          {/* 5 columnas cuando hay plata: el hero ocupa 2 y los otros tres 1
              cada uno, así entra todo en una sola fila. */}
          <section className={`grid grid-cols-2 gap-4 mb-10 ${showMoney ? 'lg:grid-cols-5' : 'lg:grid-cols-3'}`}>
            {showMoney && (
              <StatsCard
                title="Ingresos del mes"
                value={fmtARS(monthRevenue)}
                icon={<DollarSign className="w-5 h-5" />}
                tone="hero"
                hint={new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                loading={loading}
                className="col-span-2"
              />
            )}

            <StatsCard
              title="Socios al día"
              value={stats?.members_active ?? 0}
              icon={<UserCheck className="w-5 h-5" />}
              tone="brand"
              /* El ratio activos/total antes había que sacarlo de cabeza
                 comparando dos tarjetas separadas. */
              meter={activeRatio}
              hint={`de ${stats?.members_total ?? 0} socios · ${activeRatio}%`}
              loading={loading}
            />

            <StatsCard
              title="Vencidos"
              value={stats?.members_inactive ?? 0}
              icon={<UserX className="w-5 h-5" />}
              tone={(stats?.members_inactive ?? 0) > 0 ? 'alert' : 'neutral'}
              hint={(stats?.members_inactive ?? 0) > 0 ? 'Requieren gestión de cobro' : 'Nadie con la cuota vencida'}
              loading={loading}
            />

            <StatsCard
              title="Accesos hoy"
              value={stats?.accesses_success_today ?? 0}
              icon={<ClipboardCheck className="w-5 h-5" />}
              tone="neutral"
              /* La vista ya trae autorizados y rechazados por separado; la
                 tarjeta anterior los sumaba y perdía el dato accionable. */
              hint={
                (stats?.accesses_denied_today ?? 0) > 0
                  ? `${stats?.accesses_denied_today} rechazado${(stats?.accesses_denied_today ?? 0) === 1 ? '' : 's'} en la puerta`
                  : 'Sin rechazos en la puerta'
              }
              loading={loading}
            />

            {!showMoney && (
              <StatsCard
                title="Total socios"
                value={stats?.members_total ?? 0}
                icon={<Users className="w-5 h-5" />}
                tone="neutral"
                loading={loading}
              />
            )}
          </section>



          {/* Activity Section */}
          <div className={showMoney ? 'grid lg:grid-cols-3 gap-8 mb-10' : 'grid gap-8 mb-10'}>
            {showMoney && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2 space-y-6"
              >
                <div className="rounded-2xl border border-carbon-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-carbon-200 dark:border-white/10">
                    <h2 className="text-sm font-black uppercase tracking-widest text-carbon-900 dark:text-white flex items-center gap-2">
                      <span className="rounded-lg bg-[#899878]/15 p-1.5 text-[#5F6E50] dark:text-[#899878]">
                        <Activity className="w-4 h-4" />
                      </span>
                      Pagos recientes
                    </h2>
                    <Link href="/payments" className="text-xs font-bold text-[#5F6E50] dark:text-[#899878] hover:underline flex items-center gap-1 shrink-0">
                      Ver todos <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto p-3 custom-scrollbar">
                    <RecentActivity rows={payments} loading={loading} />
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border border-carbon-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-carbon-200 dark:border-white/10">
                  <h2 className="text-sm font-black uppercase tracking-widest text-carbon-900 dark:text-white flex items-center gap-2">
                    <span className="rounded-lg bg-alert-600/12 p-1.5 text-alert-600 dark:text-alert-400">
                      <UserX className="w-4 h-4" />
                    </span>
                    Próximos vencimientos
                  </h2>
                  <p className="mt-1 text-[11px] font-medium text-carbon-500 dark:text-carbon-400">
                    Cuotas que vencen en los próximos 7 días
                  </p>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-3 custom-scrollbar">
                  <ExpiringMembers rows={stats?.expiring_next_7d ?? []} loading={loading} />
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-carbon-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-carbon-200 dark:border-white/10">
                <h2 className="text-sm font-black uppercase tracking-widest text-carbon-900 dark:text-white flex items-center gap-2">
                  <span className="rounded-lg bg-[#899878]/15 p-1.5 text-[#5F6E50] dark:text-[#899878]">
                    <ClipboardCheck className="w-4 h-4" />
                  </span>
                  Historial de accesos
                </h2>
                <Link href="/access-log" className="text-xs font-bold text-[#5F6E50] dark:text-[#899878] hover:underline flex items-center gap-1 shrink-0">
                  Ver completo <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="p-3">
                <RecentAccess rows={access} loading={loading} />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  )
}
