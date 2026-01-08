'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '../layouts/AdminLayout'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import {
  TrendingUp, Users, DollarSign, Wallet, AlertTriangle,
  Activity, Calendar, Receipt, ChevronRight, Info
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

/* =============== página =============== */
export default function MetricasPage() {
  const [loading, setLoading] = useState(true)

  const [payments, setPayments] = useState<Payment[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [accessLogsToday, setAccessLogsToday] = useState<number>(0)
  const [recentAccesses, setRecentAccesses] = useState<Access[]>([])

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

  const revenueDaily = useMemo(() => {
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
      day: shortDay(new Date(k + 'T00:00:00')),
      revenue: v,
    }))
  }, [payments])

  const monthSeq = useMemo(() => {
    const now = startOfMonth()
    const out: Date[] = []
    for (let i = 5; i >= 0; i--) {
      out.push(new Date(now.getFullYear(), now.getMonth() - i, 1))
    }
    return out
  }, [])

  const performanceBars = useMemo(() => {
    return monthSeq.map(m => {
      const s = startOfMonth(m)
      const e = addDays(endOfMonth(m), 1)
      const altas = memberships.filter(x => x.start_date && tzDate(x.start_date) >= s && tzDate(x.start_date) < e)
      return { month: monthLabel(m), altas: altas.length }
    })
  }, [memberships, monthSeq])

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
      {/* Background Decor */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute -right-[5%] bottom-[5%] h-[30%] w-[30%] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-indigo-600 ring-1 ring-inset ring-indigo-600/20">
                Performance
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              Dashboard de <span className="text-indigo-600">Métricas</span>
            </h1>
            <p className="max-w-md text-slate-500 font-medium italic">
              "Lo que no se mide, no se puede mejorar."
            </p>
          </motion.div>
        </header>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-10">
          <KpiCard
            label="Socios Activos"
            value={activeMembers}
            icon={<Users />}
            loading={loading}
            color="indigo"
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
          <KpiCard
            label="Promedio x Socio"
            value={fmtMoney(averagePerMember)}
            icon={<Wallet />}
            loading={loading}
            color="blue"
          />
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Revenue Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 rounded-[32px] border border-slate-200 bg-white/80 backdrop-blur-xl p-8 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Evolución de Ingresos</h3>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mt-1">Últimos 30 días</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Activity className="w-6 h-6" />
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueDaily}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: any) => [fmtMoney(Number(v)), 'Ingresos']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

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
          {/* New Members Bars */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-[32px] border border-slate-200 bg-white/80 backdrop-blur-xl p-8 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nuevas Altas</h3>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mt-1">Histórico 6 Meses</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceBars}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9', radius: 10 }}
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="altas" fill="#10b981" radius={[10, 10, 10, 10]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

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

/* =============== subcomponentes =============== */

function KpiCard({ label, value, icon, trend, description, color, loading }: any) {
  const colors: any = {
    indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-500/10',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-500/10',
    rose: 'bg-rose-50 text-rose-600 ring-rose-500/10',
    blue: 'bg-blue-50 text-blue-600 ring-blue-500/10'
  }

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="group relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-2xl"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colors[color]} ring-1 ring-inset`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-black ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <div className="text-2xl font-black text-slate-900">
          {loading ? <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg" /> : value}
        </div>
        {description && <p className="text-[10px] font-medium text-slate-500 mt-1 italic">{description}</p>}
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
