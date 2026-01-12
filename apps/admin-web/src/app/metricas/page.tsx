'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '../layouts/AdminLayout'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, BarChart, Bar
} from 'recharts'
import {
  TrendingUp, Users, DollarSign, Wallet, AlertTriangle,
  Activity, Receipt, ArrowUpRight, ArrowDownRight, Info
} from 'lucide-react'

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

type Access = { user_id: string; scanned_at: string; result: string }

type ClassRow = { id: number; name: string }
type EnrollmentRow = { user_id: string; class_id: number }

type LandingEvent = {
  event_type: string
  created_at: string
}

/* =============== página =============== */
export default function MetricasPage() {
  const [loading, setLoading] = useState(true)

  const [payments, setPayments] = useState<Payment[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [accessLogsToday, setAccessLogsToday] = useState<number>(0)
  const [recentAccesses, setRecentAccesses] = useState<Access[]>([])
  const [landingEvents, setLandingEvents] = useState<LandingEvent[]>([])

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { count: profilesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      setTotalMembers(profilesCount || 0)

      const sixMonthsAgo = startOfMonth(addDays(today(), -180))
      const { data: memb } = await supabase
        .from('memberships')
        .select('member_id,start_date,end_date,type')
        .gte('start_date', sixMonthsAgo.toISOString().slice(0, 10))
      setMemberships((memb || []) as Membership[])

      const ninetyDaysAgo = addDays(today(), -90)
      const { data: pays } = await supabase
        .from('payments')
        .select('user_id,amount,method,paid_at,period_from,period_to')
        .gte('paid_at', ninetyDaysAgo.toISOString())
        .order('paid_at', { ascending: true })
      setPayments((pays || []) as Payment[])

      const start = today().toISOString()
      const { count: accCount } = await supabase
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .gte('scanned_at', start)
      setAccessLogsToday(accCount || 0)

      const tenDaysAgo = addDays(today(), -10).toISOString()
      const { data: recentAcc } = await supabase
        .from('access_logs')
        .select('user_id,scanned_at,result')
        .gte('scanned_at', tenDaysAgo)
      setRecentAccesses((recentAcc || []) as Access[])

      const { data: cls } = await supabase
        .from('classes')
        .select('id,name')
        .order('name', { ascending: true })
      setClasses((cls ?? []) as ClassRow[])

      const { data: enr } = await supabase
        .from('class_enrollments')
        .select('user_id,class_id')
      setEnrollments((enr ?? []) as EnrollmentRow[])

      const { data: lnd } = await supabase
        .from('landing_events')
        .select('event_type,created_at')
        .gte('created_at', ninetyDaysAgo.toISOString()) // Reusamos la fecha de 90 días
      setLandingEvents((lnd ?? []) as LandingEvent[])

      setLoading(false)
    }

    fetchData()
  }, [])

  /* ================= KPIs ================= */

  const activeUserIds = useMemo(() => {
    const now = today()
    const set = new Set<string>()
    memberships.forEach(m => {
      if (m.end_date && tzDate(m.end_date) >= now) set.add(m.member_id)
    })
    return set
  }, [memberships])

  const activeMembers = activeUserIds.size

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

  const revenueThisMonth = useMemo(() => {
    const s = startOfMonth()
    const e = addDays(endOfMonth(), 1)
    return payments
      .filter(p => p.paid_at && tzDate(p.paid_at) >= s && tzDate(p.paid_at) < e)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  }, [payments])

  const revenuePrevMonth = useMemo(() => {
    const base = startOfMonth()
    const s = startOfMonth(new Date(base.getFullYear(), base.getMonth() - 1, 1))
    const e = startOfMonth(base)
    return payments
      .filter(p => p.paid_at && tzDate(p.paid_at) >= s && tzDate(p.paid_at) < e)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  }, [payments])

  const growth = useMemo(() => {
    if (!revenuePrevMonth) return revenueThisMonth ? 100 : 0
    return ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100
  }, [revenueThisMonth, revenuePrevMonth])

  const averagePerMember = useMemo(() => {
    if (!activeMembers) return 0
    return revenueThisMonth / activeMembers
  }, [revenueThisMonth, activeMembers])

  const membersAtRisk = useMemo(() => {
    const activeArr = Array.from(activeUserIds)
    const accessSet = new Set(recentAccesses.map(a => a.user_id))
    return activeArr.filter(id => !accessSet.has(id)).length
  }, [activeUserIds, recentAccesses])

  /* ================= Gráficos ================= */

  const revenueTrend = useMemo(() => {
    const start = addDays(today(), -30)
    const map = new Map<string, number>()
    for (let i = 0; i <= 30; i++) {
      const d = addDays(start, i)
      map.set(d.toISOString().slice(0, 10), 0)
    }
    payments.forEach(p => {
      if (!p.paid_at) return
      const key = tzDate(p.paid_at).toISOString().slice(0, 10)
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + (Number(p.amount) || 0))
      }
    })
    return Array.from(map.entries()).map(([k, v]) => ({
      date: shortDay(new Date(k + 'T00:00:00')),
      amount: v,
    }))
  }, [payments])

  const attendanceByClass = useMemo(() => {
    const actives: Record<number, number> = {}
    enrollments.forEach(e => {
      if (activeUserIds.has(e.user_id)) {
        actives[e.class_id] = (actives[e.class_id] ?? 0) + 1
      }
    })
    return classes.map(c => ({
      className: c.name,
      count: actives[c.id] ?? 0,
    })).filter(c => c.count > 0)
  }, [classes, enrollments, activeUserIds])

  const studentsByClass = useMemo(() => {
    const actives: Record<number, number> = {}
    enrollments.forEach(e => {
      if (activeUserIds.has(e.user_id)) {
        actives[e.class_id] = (actives[e.class_id] ?? 0) + 1
      }
    })
    return classes.map(c => ({
      name: c.name,
      value: actives[c.id] ?? 0,
    })).filter(c => c.value > 0)
  }, [classes, enrollments, activeUserIds])

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']

  return (
    <AdminLayout active="/metricas">
      <div className="relative isolate min-h-screen bg-[#FDFDFD] dark:bg-[#0a0a0a] overflow-hidden transition-colors duration-500">
        {/* Background Elements */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] opacity-50 dark:opacity-20" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] opacity-50 dark:opacity-20" />
        </div>

        <div className="relative mx-auto max-w-7xl p-6 md:p-8">
          {/* Header Section */}
          <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-600/20 dark:ring-indigo-400/20">
                  Analytics
                </span>
              </div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
                Dashboard de <span className="text-indigo-600 dark:text-indigo-400">Métricas</span>
              </h1>
              <p className="max-w-md text-slate-500 dark:text-slate-400 font-medium italic">
                "Lo que no se mide, no se puede mejorar."
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3"
            >
              <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  En tiempo real
                </span>
              </div>
            </motion.div>
          </header>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            <KpiCard
              label="Socios Activos"
              value={activeMembers}
              icon={<Users />}
              color="indigo"
              loading={loading}
            />
            <KpiCard
              label="Recaudación Mes"
              value={fmtMoney(revenueThisMonth)}
              icon={<DollarSign />}
              loading={loading}
              color="emerald"
              trend={growth}
            />
            <KpiCard
              label="Alumnos en Riesgo"
              value={membersAtRisk}
              icon={<AlertTriangle />}
              loading={loading}
              color="rose"
              description="Sin asistencia en 10 días"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Class Attendance Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-8 rounded-[32px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl"
            >
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <TrendingUp className="w-5 h-5" />
                </span>
                Asistencia por Clase (Últimos 30 días)
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceByClass}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                    <XAxis
                      dataKey="className"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                      barSize={40}
                    >
                      {attendanceByClass.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#6366F1', '#8B5CF6', '#EC4899'][index % 3]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Revenue Trend Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-8 rounded-[32px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl"
            >
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </span>
                Ingresos vs Mes Anterior
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrend}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10B981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
          {/* Distribution Pie */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[32px] border border-slate-200 bg-white/80 backdrop-blur-xl p-8 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Alumnos x Clase</h3>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mt-1">Sólo Socios Activos</p>
              </div>
            </div>
            <div className="h-72 flex flex-col justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentsByClass}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {studentsByClass.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Secondary Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Landing Metrics (Nuevo) */}
          <LandingMetricsCard events={landingEvents} loading={loading} />

          {/* Quick Stats Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-[32px] bg-slate-900 p-8 shadow-2xl overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Receipt className="w-48 h-48 text-white rotate-12" />
            </div>

            <div className="relative z-10">
              <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Estado de Cobros</h3>

              <div className="space-y-6">
                <StatLine label="Vencimientos Próximos 7 días" value={expiring7d} icon={<ClockIcon />} />
                <StatLine label="Accesos Registrados Hoy" value={accessLogsToday} icon={<ZapIcon />} />
                <StatLine label="Total Alumnos Histórico" value={totalMembers} icon={<UsersIcon />} />
              </div>

              <div className="mt-10 pt-8 border-t border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Crecimiento Mensual</p>
                  <p className="text-2xl font-black text-emerald-400">{growth > 0 ? '+' : ''}{growth.toFixed(1)}%</p>
                </div>
                <button className="h-12 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest transition-all">
                  Detalles
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  )
}

/* ======================== Components ======================== */

function KpiCard({ label, value, icon, color, loading, trend, description }: any) {
  const colors: any = {
    indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-500/10 dark:bg-indigo-900/30 dark:text-indigo-400 dark:ring-indigo-500/30',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-500/10 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30',
    rose: 'bg-rose-50 text-rose-600 ring-rose-500/10 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-500/30'
  }

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="group relative overflow-hidden rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm transition-all hover:shadow-2xl"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-4 rounded-2xl ${colors[color]} ring-1 ring-inset transition-colors`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-black uppercase tracking-wider px-2 py-1 rounded-full ${trend > 0
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
            }`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
        <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {loading ? <div className="h-10 w-32 bg-slate-100 dark:bg-slate-700 animate-pulse rounded-xl" /> : value}
        </div>
        {description && (
          <p className="mt-2 text-xs font-bold text-slate-400 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {description}
          </p>
        )}
      </div>
    </motion.div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl">
        <p className="opacity-50 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-lg">
          {typeof payload[0].value === 'number' && payload[0].value > 1000
            ? fmtMoney(payload[0].value)
            : payload[0].value}
        </p>
      </div>
    )
  }
  return null
}

function LandingMetricsCard({ events, loading }: any) {
  if (loading) return (
    <div className="w-full h-40 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-[32px]" />
  )

  const todayStr = new Date().toISOString().slice(0, 10)

  const visitorCount = events.filter((e: any) => e.event_type === 'page_view').length
  const clickCount = events.filter((e: any) => e.event_type === 'cta_click' || e.event_type === 'click_whatsapp' || e.event_type === 'click_instagram').length
  const conversionRate = visitorCount > 0 ? ((clickCount / visitorCount) * 100).toFixed(1) : 0

  const visitsToday = events.filter((e: any) => e.event_type === 'page_view' && e.created_at.startsWith(todayStr)).length
  const visitsTotal = visitorCount
  const clicksWsp = events.filter((e: any) => e.event_type === 'click_whatsapp').length
  const clicksInsta = events.filter((e: any) => e.event_type === 'click_instagram').length

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-2xl"
    >
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Activity className="w-64 h-64" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest border border-white/10">
            Marketing
          </span>
        </div>
        <h3 className="text-2xl font-black tracking-tight mb-1">Landing Page Performance</h3>
        <p className="text-slate-400 font-medium text-sm mb-8">Métricas de conversión y tráfico web</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Visitas Hoy</p>
            <p className="text-2xl font-black text-slate-900">{visitsToday}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Total (90d)</p>
            <p className="text-2xl font-black text-slate-900">{visitsTotal}</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-4">
            <p className="text-[10px] uppercase font-black text-green-600 mb-1">Clicks WhatsApp</p>
            <p className="text-2xl font-black text-green-700">{clicksWsp}</p>
          </div>
          <div className="bg-purple-50 rounded-2xl p-4">
            <p className="text-[10px] uppercase font-black text-purple-600 mb-1">Clicks Instagram</p>
            <p className="text-2xl font-black text-purple-700">{clicksInsta}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-500">Tasa de Conversión</span>
          <span className="text-xl font-black text-blue-600">{conversionRate}%</span>
        </div>
      </div>
    </motion.div>
  )
}

function StatLine({ label, value, icon }: any) {
  return (
    <div className="flex items-center justify-between group cursor-default">
      <div className="flex items-center gap-3">
        <div className="text-white/40 group-hover:text-white transition-colors">
          {icon}
        </div>
        <p className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{label}</p>
      </div>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  )
}

function ClockIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function ZapIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> }
function UsersIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> }
