'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../layouts/AdminLayout'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/* =============== helpers fecha / número =============== */
const tzDate = (v: string | Date) => new Date(v)
const fmtMoney = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const shortDay = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
const monthLabel = (d: Date) => d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })

/* =============== tipos =============== */
type Payment = {
  user_id: string
  amount: number
  method: string | null
  paid_at: string | null
  period_from: string | null
  period_to: string | null
}

type Membership = {
  member_id: string
  start_date: string | null
  end_date: string | null
  type: string | null
}

type Access = { scanned_at: string; result: string }

type ClassRow = { id: number; name: string }
type EnrollmentRow = { user_id: string; class_id: number }

/* =============== página =============== */
export default function MetricasPage() {
  const [loading, setLoading] = useState(true)

  // crudos
  const [payments, setPayments] = useState<Payment[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [accessLogsToday, setAccessLogsToday] = useState<number>(0)

  // NUEVO: clases y inscripciones
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      // perfiles (conteo total)
      const { count: profilesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      setTotalMembers(profilesCount || 0)

      // memberships (necesitamos 6 meses para altas/vencimientos)
      const sixMonthsAgo = startOfMonth(addDays(today(), -180))
      const { data: memb } = await supabase
        .from('memberships')
        .select('member_id,start_date,end_date,type')
        .gte('start_date', sixMonthsAgo.toISOString().slice(0, 10)) // altas de los últimos meses
      setMemberships((memb || []) as Membership[])

      // payments (90 días para revenue)
      const ninetyDaysAgo = addDays(today(), -90)
      const { data: pays } = await supabase
        .from('payments')
        .select('user_id,amount,method,paid_at,period_from,period_to')
        .gte('paid_at', ninetyDaysAgo.toISOString())
        .order('paid_at', { ascending: true })
      setPayments((pays || []) as Payment[])

      // accesses hoy
      const start = today().toISOString()
      const end = addDays(today(), 1).toISOString()
      const { count: accCount } = await supabase
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .gte('scanned_at', start)
        .lt('scanned_at', end)
      setAccessLogsToday(accCount || 0)

      // ===== NUEVO: clases e inscripciones =====
      const { data: cls } = await supabase
        .from('classes')
        .select('id,name')
        .order('name', { ascending: true })
      setClasses((cls ?? []) as ClassRow[])

      const { data: enr } = await supabase
        .from('class_enrollments')
        .select('user_id,class_id')
      setEnrollments((enr ?? []) as EnrollmentRow[])

      setLoading(false)
    }

    fetchData()
  }, [])

  /* ================= KPIs ================= */

  // activos: miembros con end_date >= hoy (set para usarlo en alumnos por clase)
  const activeUserIds = useMemo(() => {
    const now = today()
    const set = new Set<string>()
    memberships.forEach(m => {
      if (m.end_date && tzDate(m.end_date) >= now) set.add(m.member_id)
    })
    return set
  }, [memberships])

  const activeMembers = activeUserIds.size

  // a vencer 7 días: end_date between hoy..+7
  const expiring7d = useMemo(() => {
    const start = today()
    const end = addDays(start, 7)
    const seen = new Set<string>()
    memberships.forEach(m => {
      if (!m.end_date) return
      const d = tzDate(m.end_date)
      if (d >= start && d <= end) seen.add(m.member_id)
    })
    return seen.size
  }, [memberships])

  // ingresos del mes y del mes anterior
  const revenueThisMonth = useMemo(() => {
    const s = startOfMonth()
    const e = addDays(endOfMonth(), 1) // exclusivo
    return payments
      .filter(p => p.paid_at && tzDate(p.paid_at) >= s && tzDate(p.paid_at) < e)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  }, [payments])

  const revenuePrevMonth = useMemo(() => {
    const base = startOfMonth()
    const s = startOfMonth(new Date(base.getFullYear(), base.getMonth() - 1, 1))
    const e = startOfMonth(base) // exclusivo
    return payments
      .filter(p => p.paid_at && tzDate(p.paid_at) >= s && tzDate(p.paid_at) < e)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  }, [payments])

  const mom = useMemo(() => {
    if (!revenuePrevMonth) return revenueThisMonth ? 100 : 0
    return ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100
  }, [revenueThisMonth, revenuePrevMonth])

  const arpu = useMemo(() => {
    if (!activeMembers) return 0
    return revenueThisMonth / activeMembers
  }, [revenueThisMonth, activeMembers])

  /* ================= Gráficos ================= */

  // 1) revenue diario últimos 90 días
  const revenueDaily = useMemo(() => {
    const start = addDays(today(), -90)
    const map = new Map<string, number>()
    // seed 91 días para que el gráfico no tenga agujeros
    for (let i = 0; i <= 90; i++) {
      const d = addDays(start, i)
      map.set(d.toISOString().slice(0, 10), 0)
    }
    payments.forEach(p => {
      if (!p.paid_at) return
      const key = tzDate(p.paid_at).toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, 0)
      map.set(key, (map.get(key) || 0) + (Number(p.amount) || 0))
    })
    return Array.from(map.entries()).map(([k, v]) => ({
      day: shortDay(new Date(k + 'T00:00:00')),
      revenue: v,
    }))
  }, [payments])

  // 2) altas vs “vencen” por mes (últimos 6)
  const monthSeq = useMemo(() => {
    const now = startOfMonth()
    const out: Date[] = []
    for (let i = 5; i >= 0; i--) {
      out.push(new Date(now.getFullYear(), now.getMonth() - i, 1))
    }
    return out
  }, [])

  const churnBars = useMemo(() => {
    return monthSeq.map(m => {
      const s = startOfMonth(m)
      const e = addDays(endOfMonth(m), 1)
      const altas = memberships.filter(x => x.start_date && tzDate(x.start_date) >= s && tzDate(x.start_date) < e)
      const vencen = memberships.filter(x => x.end_date && tzDate(x.end_date) >= s && tzDate(x.end_date) < e)
      return { month: monthLabel(m), altas: altas.length, vencen: vencen.length }
    })
  }, [memberships, monthSeq])

  // 3) método de pago del mes (donut)
  const paymentMethodThisMonth = useMemo(() => {
    const s = startOfMonth()
    const e = addDays(endOfMonth(), 1)
    const map = new Map<string, number>()
    payments.forEach(p => {
      if (!p.paid_at) return
      const d = tzDate(p.paid_at)
      if (d < s || d >= e) return
      const k = (p.method || 'otro').toLowerCase()
      map.set(k, (map.get(k) || 0) + (Number(p.amount) || 0))
    })
    const arr = Array.from(map.entries()).map(([name, value]) => ({ name, value }))
    return arr.length ? arr : [{ name: 'sin datos', value: 1 }]
  }, [payments])

  // ===== NUEVO: Q de alumnos por clase (Total vs Activos) =====
  const studentsByClass = useMemo(() => {
    const totals: Record<number, number> = {}
    const actives: Record<number, number> = {}
    enrollments.forEach(e => {
      totals[e.class_id] = (totals[e.class_id] ?? 0) + 1
      if (activeUserIds.has(e.user_id)) {
        actives[e.class_id] = (actives[e.class_id] ?? 0) + 1
      }
    })
    return classes.map(c => ({
      class_name: c.name,
      total: totals[c.id] ?? 0,
      activos: actives[c.id] ?? 0,
    }))
  }, [classes, enrollments, activeUserIds])

  const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <AdminLayout active="/metricas">
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Métricas</h1>
          <p className="text-slate-600">Estado general del dojo</p>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <KpiCard label="Miembros" value={totalMembers} loading={loading} />
          <KpiCard label="Activos" value={activeMembers} variant="good" loading={loading} />
          <KpiCard label="A vencer (7d)" value={expiring7d} variant="warn" loading={loading} />
          <KpiCard label="Ingresos mes" value={fmtMoney(revenueThisMonth)} loading={loading} />
          <KpiCard label="Mes anterior" value={fmtMoney(revenuePrevMonth)} loading={loading} />
          <KpiCard
            label="MoM"
            value={`${(mom >= 0 ? '+' : '')}${mom.toFixed(1)}%`}
            variant={mom >= 0 ? 'good' : 'bad'}
            loading={loading}
          />
          <KpiCard label="ARPU" value={fmtMoney(arpu)} loading={loading} />
          <KpiCard label="Accesos hoy" value={accessLogsToday} loading={loading} />
        </div>

        {/* NUEVO: Q alumnos por clase */}
        <section className="rounded-2xl border bg-white shadow-sm p-5">
          <h2 className="text-lg font-semibold mb-3">Q de alumnos por clase (Total vs Activos)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studentsByClass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class_name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#3b82f6" />
                <Bar dataKey="activos" name="Activos" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* GRÁFICO: Ingresos diarios 90d */}
        <section className="rounded-2xl border bg-white shadow-sm p-5">
          <h2 className="text-lg font-semibold mb-3">Ingresos diarios (últimos 90 días)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueDaily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" interval="preserveStartEnd" />
                <YAxis />
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* GRÁFICO: Altas vs Vencen (6 meses) */}
        <section className="rounded-2xl border bg-white shadow-sm p-5">
          <h2 className="text-lg font-semibold mb-3">Altas vs. Vencimientos (últimos 6 meses)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={churnBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="altas" fill="#10b981" />
                <Bar dataKey="vencen" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* GRÁFICO: Método de pago del mes */}
        <section className="rounded-2xl border bg-white shadow-sm p-5">
          <h2 className="text-lg font-semibold mb-3">Método de pago (mes actual)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodThisMonth}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                >
                  {paymentMethodThisMonth.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

/* =============== mini componente KPI =============== */
function KpiCard({
  label,
  value,
  variant,
  loading,
}: {
  label: string
  value: number | string
  variant?: 'good' | 'bad' | 'warn'
  loading?: boolean
}) {
  const color =
    variant === 'good'
      ? 'text-emerald-600'
      : variant === 'bad'
        ? 'text-rose-600'
        : variant === 'warn'
          ? 'text-amber-600'
          : 'text-slate-900'

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>
        {loading ? <span className="animate-pulse text-slate-300">•••</span> : value}
      </div>
    </div>
  )
}
