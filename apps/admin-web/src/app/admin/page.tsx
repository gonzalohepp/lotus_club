'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../layouts/AdminLayout'
import StatsCard from '../components/dashboard/StatsCard'
import RecentActivity from '../components/dashboard/RecentActivity'
import ExpiringMembers from '../components/dashboard/ExpiringMembers'
import RecentAccess from '../components/dashboard/RecentAccess'
import { Users, UserCheck, UserX, DollarSign, ClipboardCheck } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
}

type PayRow = {
  amount: number
  method: string | null
  paid_at: string
  profiles?: { first_name: string | null; last_name: string | null } | null
}

type AccessRow = {
  scanned_at: string
  result: 'authorized' | 'denied' | 'unknown'
  reason: string | null
  profiles?: { first_name: string | null; last_name: string | null } | null
}

function normalizeResult(value: string | null | undefined): 'authorized' | 'denied' | 'unknown' {
  const v = (value ?? '').trim().toLowerCase()
  if (['autorizado', 'authorized', 'ok', 'success', 'permitido', 'allow'].includes(v)) return 'authorized'
  if (['denegado', 'denied', 'reject', 'rejected'].includes(v)) return 'denied'
  return 'unknown'
}

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n || 0)

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [payments, setPayments] = useState<PayRow[]>([])
  const [access, setAccess] = useState<AccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [
          { data: s, error: se },
          { data: p, error: pe },
          { data: a, error: ae },
        ] = await Promise.all([
          supabase.from('dashboard_stats').select('*').maybeSingle(),
          supabase
            .from('payments')
            .select('amount, method, paid_at, profiles!payments_user_id_fkey(first_name,last_name)')
            .order('paid_at', { ascending: false })
            .limit(5),
          supabase
            .from('access_logs')
            .select('scanned_at, result, reason, profiles!access_logs_user_id_fkey(first_name,last_name)')
            .order('scanned_at', { ascending: false })
            .limit(10),
        ])

        if (se) throw se
        if (pe) throw pe
        if (ae) throw ae

        setStats(s as Stats)
        setPayments((p ?? []) as PayRow[])

        const normalized = (a ?? []).map((row: any) => ({
          ...row,
          result: normalizeResult(row.result),
        })) as AccessRow[]
        setAccess(normalized)
      } catch (e: any) {
        setError(e?.message ?? 'Error cargando dashboard')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Panel de Control</h1>
        <p className="text-slate-600">Vista general de tu gimnasio</p>
      </div>

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-50 border border-red-200 rounded-lg">
          Error: {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
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
        <StatsCard
          title="Ingresos del Mes"
          value={fmtARS(monthRevenue)}
          icon={<DollarSign className="w-5 h-5" />}
          color="purple"
          loading={loading}
        />
        <StatsCard
          title="Accesos Hoy"
          value={(stats?.accesses_success_today ?? 0) + (stats?.accesses_denied_today ?? 0)}
          icon={<ClipboardCheck className="w-5 h-5" />}
          color="blue"
          loading={loading}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="max-h-[420px] overflow-y-auto pr-2">
            <RecentActivity rows={payments} loading={loading} />
          </div>
        </div>
        <div>
          <ExpiringMembers rows={stats?.expiring_next_7d ?? []} loading={loading} />
        </div>
      </div>

      <RecentAccess rows={access} loading={loading} />
    </AdminLayout>
  )
}
