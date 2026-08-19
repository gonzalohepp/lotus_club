'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'
import AdminLayout from '../layouts/AdminLayout'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import {
  TrendingUp, Users, DollarSign, AlertTriangle,
  Activity, Download, FileDown, UserCheck, Clock, CalendarCheck
} from 'lucide-react'
import { exportToExcel } from '@/lib/excelExport'

/* =============== helpers =============== */
const tzDate = (v: string | Date) => new Date(v)
const fmtMoney = (n: number) => `$${n.toLocaleString('es-AR')}`

function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const shortDay = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

/**
 * Nombre para los exports. Sin esto el Excel salía con el UUID del usuario: las
 * consultas traían `user_id` pelado y `exportToExcel` vuelca el objeto tal cual,
 * así que la columna quedaba inservible para quien abre el archivo.
 */
const nombreDe = (
  p: { first_name: string | null; last_name: string | null }
   | { first_name: string | null; last_name: string | null }[]
   | null | undefined
) => {
  const perfil = Array.isArray(p) ? p[0] : p
  if (!perfil) return 'Sin nombre'
  return `${perfil.first_name ?? ''} ${perfil.last_name ?? ''}`.trim() || 'Sin nombre'
}

const fmtFecha = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-AR') : ''

const fmtHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''

/* =============== tipos =============== */
/** El embed de PostgREST devuelve objeto o array según la cardinalidad. */
type ProfileRef = { first_name: string | null; last_name: string | null }

interface Payment {
  user_id: string; amount: number; method: string | null
  paid_at: string | null; period_from: string | null; period_to: string | null
  profiles?: ProfileRef | ProfileRef[] | null
}
interface Membership {
  member_id: string; start_date: string | null; end_date: string | null; type: string | null
}
interface Access {
  user_id: string; scanned_at: string; result: string
}
interface AccessWithProfile extends Access {
  profiles: { first_name: string | null; last_name: string | null; avatar_url: string | null } |
  { first_name: string | null; last_name: string | null; avatar_url: string | null }[] | null
}
interface ClassRow { id: number; name: string }
interface EnrollmentRow { user_id: string; class_id: number }


/**
 * Recharts recibe colores como valores JS, no como clases, así que no puede
 * heredar el tema por CSS. El tema vive como clase `dark` en <html>.
 */
function useIsDark() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const read = () => setIsDark(root.classList.contains('dark'))
    read()
    const obs = new MutationObserver(read)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

/** Cromo de los gráficos por tema. Los acentos no cambian: rinden en ambos. */
const VIZ = {
  light: { surface: '#FFFFFF', grid: '#E7E8E4', axis: '#72736F' },
  dark: { surface: '#222725', grid: '#2C322E', axis: '#848580' },
} as const

/* =============== página =============== */
export default function MetricasPage() {
  // Todas las métricas son de la sede activa: mezclar dos sucursales en un
  // mismo gráfico de ingresos o de asistencia no significa nada.
  const { activeDojo } = useTenant()
  const dojoId = activeDojo?.id

  const isDark = useIsDark()
  const C = isDark ? VIZ.dark : VIZ.light

  const [loading, setLoading] = useState(true)

  const [payments, setPayments] = useState<Payment[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [activeMembers, setActiveMembers] = useState(0)
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set())
  const [accessLogsToday, setAccessLogsToday] = useState<number>(0)
  const [recentAccesses, setRecentAccesses] = useState<AccessWithProfile[]>([])

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])

  const [selectedClass, setSelectedClass] = useState<number | 'general'>('general')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { data: viewData } = await supabase
        .from('members_with_status')
        .select('user_id, status, role')
        .eq('dojo_id', dojoId ?? NO_DOJO)

      const allViewRows = (viewData || [])
      setTotalMembers(allViewRows.filter(r => r.role !== 'admin').length)
      const activeIds = allViewRows
        .filter(r => r.status === 'activo' && r.role !== 'admin')
        .map(r => r.user_id)
      setActiveMembers(activeIds.length)
      setActiveUserIds(new Set(activeIds))

      const sixMonthsAgo = startOfMonth(addDays(today(), -180))
      const { data: memb } = await supabase
        .from('memberships')
        .select('member_id,start_date,end_date,type')
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .gte('start_date', sixMonthsAgo.toISOString().slice(0, 10))
      setMemberships((memb || []) as Membership[])

      const ninetyDaysAgo = addDays(today(), -90)
      const { data: pays } = await supabase
        .from('payments')
        .select(`
          user_id,
          amount,
          method,
          paid_at,
          period_from,
          period_to,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .gte('paid_at', ninetyDaysAgo.toISOString())
        .order('paid_at', { ascending: true })
      setPayments((pays || []) as Payment[])

      const todayLocal = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD local
      const { count: accCount } = await supabase
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .eq('result', 'autorizado')
        .gte('scanned_at', todayLocal + 'T00:00:00')
      setAccessLogsToday(accCount || 0)

      const { data: recentAcc } = await supabase
        .from('access_logs')
        .select(`
          user_id,
          scanned_at,
          result,
          profiles:user_id (
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .gte('scanned_at', addDays(today(), -30).toISOString())
      setRecentAccesses((recentAcc || []) as AccessWithProfile[])

      const { data: cls } = await supabase
        .from('classes')
        .select('id,name')
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .order('name', { ascending: true })
      setClasses((cls ?? []) as ClassRow[])

      const { data: enr } = await supabase
        .from('class_enrollments')
        .select('user_id,class_id')
        .eq('dojo_id', dojoId ?? NO_DOJO)
      setEnrollments((enr ?? []) as EnrollmentRow[])

      setLoading(false)
    }

    if (!dojoId) return
    fetchData()
  }, [dojoId])

  /* ================= KPIs ================= */
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
    return Math.round(revenueThisMonth / activeMembers)
  }, [revenueThisMonth, activeMembers])

  const membersAtRisk = useMemo(() => {
    const sevenDaysAgo = addDays(today(), -7).getTime()
    const recentUserIds = new Set(
      recentAccesses
        .filter(a => a.result === 'autorizado' && new Date(a.scanned_at).getTime() >= sevenDaysAgo)
        .map(a => a.user_id)
    )
    return Array.from(activeUserIds).filter(id => !recentUserIds.has(id)).length
  }, [activeUserIds, recentAccesses])

  /* ================= Gráficos ================= */
  const peakHours = useMemo(() => {
    const hours = Array(24).fill(0)
    recentAccesses.forEach(a => {
      if (a.result === 'autorizado') {
        const h = new Date(a.scanned_at).getHours()
        hours[h]++
      }
    })
    return hours.map((count, hour) => ({
      hour: `${hour}:00`,
      count
    })).filter(h => h.count > 0)
  }, [recentAccesses])

  const filteredUsersForRanking = useMemo(() => {
    const authorized = recentAccesses.filter(a => a.result === 'autorizado')
    if (selectedClass === 'general') return authorized
    const classStudentIds = new Set(enrollments.filter(e => e.class_id === selectedClass).map(e => e.user_id))
    return authorized.filter(a => classStudentIds.has(a.user_id))
  }, [recentAccesses, enrollments, selectedClass])

  const topUsers = useMemo(() => {
    const counts: Record<string, { count: number, name: string }> = {}
    filteredUsersForRanking.forEach(a => {
      if (!a.user_id) return
      if (!counts[a.user_id]) {
        counts[a.user_id] = { count: 0, name: nombreDe(a.profiles) }
      }
      counts[a.user_id].count++
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([id, data]) => ({ id, ...data }))
  }, [filteredUsersForRanking])

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

  /* ================= Exports ================= */
  /*
   * Se arman las filas a mano en vez de pasarle el array crudo a
   * `exportToExcel`: esa función usa `XLSX.json_to_sheet`, que toma las claves
   * del objeto como encabezados. Volcando la fila de la base salían columnas
   * `user_id` y `profiles` (esta última, "[object Object]") y ninguna con el
   * nombre del alumno.
   */
  const hoy = () => new Date().toISOString().slice(0, 10)

  const exportarPagos = () => {
    exportToExcel(
      payments.map((p) => ({
        Alumno: nombreDe(p.profiles),
        Monto: Number(p.amount) || 0,
        'Método': p.method ?? '',
        'Fecha de pago': fmtFecha(p.paid_at),
        'Periodo desde': fmtFecha(p.period_from),
        'Periodo hasta': fmtFecha(p.period_to),
      })),
      `Pagos_${hoy()}`
    )
  }

  const exportarAsistencia = () => {
    exportToExcel(
      recentAccesses.map((a) => ({
        Alumno: nombreDe(a.profiles),
        Fecha: fmtFecha(a.scanned_at),
        Hora: fmtHora(a.scanned_at),
        Resultado: a.result === 'autorizado' ? 'Autorizado' : 'Denegado',
      })),
      `Asistencia_${hoy()}`
    )
  }

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

  /**
   * Una sola serie = un solo color. Antes ciclaba seis tonos sobre categorías
   * que no tienen orden natural (las clases), lo que codificaba el largo de la
   * barra en el tono: información que la barra ya da, y encima con un arcoíris
   * que es justo la estética que el manual de Kuro descarta.
   */
  const BAR_COLOR = '#899878'

  return (
    <AdminLayout active="/metricas">
      <div className="relative isolate min-h-screen bg-background overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-kuro-500/10 rounded-full blur-[100px] opacity-20" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-kuro-500/10 rounded-full blur-[100px] opacity-20" />
        </div>

        <div className="relative">
          {/* Header */}
          <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-full bg-kuro-900/30 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-kuro-400 ring-1 ring-inset ring-kuro-400/20">
                  Dashboard
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
                Panel de <span className="text-kuro-600 dark:text-kuro-400">Métricas</span>
              </h1>
              <p className="text-carbon-500 dark:text-carbon-400 font-medium text-sm">
                Resumen del estado del dojo en tiempo real.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={exportarPagos}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-carbon-100 dark:bg-white/10 border border-carbon-200 dark:border-white/15 text-xs font-bold uppercase tracking-widest text-carbon-600 dark:text-carbon-300 hover:bg-carbon-200 dark:hover:bg-white/15 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pagos</span>
              </button>
              <button
                onClick={exportarAsistencia}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-carbon-100 dark:bg-white/10 border border-carbon-200 dark:border-white/15 text-xs font-bold uppercase tracking-widest text-carbon-600 dark:text-carbon-300 hover:bg-carbon-200 dark:hover:bg-white/15 transition-all"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Asistencia</span>
              </button>
            </div>
          </header>

          {/* KPIs principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KpiCard
              label="Alumnos Activos"
              value={activeMembers}
              icon={<Users className="w-5 h-5" />}
              color="indigo"
              loading={loading}
            />
            <KpiCard
              label="Recaudación Mes"
              value={fmtMoney(revenueThisMonth)}
              icon={<DollarSign className="w-5 h-5" />}
              loading={loading}
              color="emerald"
              trend={growth}
            />
            <KpiCard
              label="Ingresos Hoy"
              value={accessLogsToday}
              icon={<UserCheck className="w-5 h-5" />}
              loading={loading}
              color="blue"
              description="Accesos autorizados"
            />
          </div>

          {/* KPIs secundarios */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <MiniKpi icon={<DollarSign className="w-4 h-4" />} label="Promedio/Alumno" value={fmtMoney(averagePerMember)} loading={loading} />
            <MiniKpi icon={<Clock className="w-4 h-4" />} label="Venc. próx. 7d" value={expiring7d} loading={loading} color="amber" />
            <MiniKpi icon={<AlertTriangle className="w-4 h-4" />} label="En Riesgo" value={membersAtRisk} loading={loading} color={membersAtRisk > 0 ? 'red' : 'emerald'} />
            <MiniKpi icon={<CalendarCheck className="w-4 h-4" />} label="Total Histórico" value={totalMembers} loading={loading} />
          </div>

          {/* Fila 1: Horarios Pico + Top Alumnos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Peak Hours */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 md:p-6 rounded-2xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 overflow-hidden"
            >
              <h3 className="text-sm font-black text-carbon-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                <span className="p-1.5 rounded-lg bg-warn-900/30 text-warn-400">
                  <Activity className="w-4 h-4" />
                </span>
                Horarios Pico (30d)
              </h3>
              <div className="h-[200px] md:h-[260px] w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={peakHours}>
                    <defs>
                      <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E2A52A" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#E2A52A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: C.axis }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: C.axis }} />
                    <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.grid}`, borderRadius: '12px', fontSize: '12px', fontWeight: 700 }} />
                    <Area type="monotone" dataKey="count" stroke="#E2A52A" strokeWidth={2} fillOpacity={1} fill="url(#colorPeak)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Top Users */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 md:p-6 rounded-2xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-black text-carbon-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                  <span className="p-1.5 rounded-lg bg-kuro-900/30 text-kuro-400">
                    <Users className="w-4 h-4" />
                  </span>
                  Top 5 Alumnos
                </h3>
                <div className="flex bg-carbon-100 dark:bg-white/10 p-0.5 rounded-lg overflow-x-auto">
                  <button
                    onClick={() => setSelectedClass('general')}
                    className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${selectedClass === 'general' ? 'bg-[#899878] text-[#121113]' : 'text-carbon-500 dark:text-carbon-400 hover:text-carbon-800 dark:hover:text-carbon-200'}`}
                  >General</button>
                  {classes.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClass(c.id)}
                      className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${selectedClass === c.id ? 'bg-[#899878] text-[#121113]' : 'text-carbon-500 dark:text-carbon-400 hover:text-carbon-800 dark:hover:text-carbon-200'}`}
                    >{c.name.split(' ')[0]}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {topUsers.map((u, i) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-carbon-100 dark:bg-white/10 hover:bg-carbon-200 dark:hover:bg-white/15 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                        i === 0
                          ? 'bg-kuro-500 text-white'
                          : 'bg-carbon-200 text-carbon-600 dark:bg-white/10 dark:text-carbon-300'
                      }`}>
                        {i + 1}
                      </div>
                      <span className="text-sm font-bold text-carbon-800 dark:text-carbon-200 truncate max-w-[180px]">
                        {u.name}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-kuro-900/30 text-kuro-400 text-xs font-black">
                      {u.count}
                    </span>
                  </div>
                ))}
                {topUsers.length === 0 && <p className="text-center text-carbon-500 dark:text-carbon-400 text-sm py-8 italic">Sin datos en este periodo</p>}
              </div>
            </motion.div>
          </div>

          {/* Fila 2: Alumnos por Clase + Tendencia Ingresos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance by Class */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 md:p-6 rounded-2xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 overflow-hidden"
            >
              <h3 className="text-sm font-black text-carbon-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                <span className="p-1.5 rounded-lg bg-kuro-900/30 text-kuro-400">
                  <TrendingUp className="w-4 h-4" />
                </span>
                Alumnos Activos por Clase
              </h3>
              <div className="h-[200px] md:h-[260px] w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceByClass}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
                    <XAxis dataKey="className" axisLine={false} tickLine={false} tick={{ fill: C.axis, fontSize: 10, fontWeight: 700 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: C.axis, fontSize: 10, fontWeight: 700 }} />
                    <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.grid}`, borderRadius: '12px', fontSize: '12px', fontWeight: 700 }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={30} fill={BAR_COLOR} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Revenue Trend */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 md:p-6 rounded-2xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-black text-carbon-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                  <span className="p-1.5 rounded-lg bg-kuro-900/30 text-kuro-400">
                    <DollarSign className="w-4 h-4" />
                  </span>
                  Ingresos (30d)
                </h3>
                <span className={`text-[10px] font-black px-2 py-1 rounded-full self-start sm:self-auto ${growth >= 0 ? 'bg-kuro-900/30 text-kuro-400' : 'bg-alert-900/30 text-alert-400'}`}>
                  {growth > 0 ? '+' : ''}{growth.toFixed(1)}% vs mes ant.
                </span>
              </div>
              <div className="h-[200px] md:h-[260px] w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrend}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#899878" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#899878" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: C.axis, fontSize: 10, fontWeight: 700 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: C.axis, fontSize: 10, fontWeight: 700 }} tickFormatter={(value) => `$${value}`} />
                    <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.grid}`, borderRadius: '12px', fontSize: '12px', fontWeight: 700 }} />
                    <Area type="monotone" dataKey="amount" stroke="#899878" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

/* ======================== Components ======================== */

function KpiCard({ label, value, icon, color, loading, trend, description }: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: 'indigo' | 'emerald' | 'rose' | 'blue'
  loading?: boolean
  trend?: number
  description?: string
}) {
  const colorMap = {
    indigo: { bg: 'bg-kuro-900/20', text: 'text-kuro-400', ring: 'ring-kuro-400/20', icon: 'bg-kuro-900/30 text-kuro-400' },
    emerald: { bg: 'bg-kuro-900/20', text: 'text-kuro-400', ring: 'ring-kuro-400/20', icon: 'bg-kuro-900/30 text-kuro-400' },
    rose: { bg: 'bg-alert-900/20', text: 'text-alert-400', ring: 'ring-alert-400/20', icon: 'bg-alert-900/30 text-alert-400' },
    blue: { bg: 'bg-kuro-900/20', text: 'text-kuro-400', ring: 'ring-kuro-400/20', icon: 'bg-kuro-900/30 text-kuro-400' },
  }
  const c = colorMap[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-2xl border border-carbon-200 dark:border-white/10 bg-white dark:bg-white/5 relative overflow-hidden`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${c.icon}`}>{icon}</div>
        {trend !== undefined && (
          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-kuro-900/30 text-kuro-400' : 'bg-alert-900/30 text-alert-400'}`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-carbon-500 dark:text-carbon-400 mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-24 bg-carbon-100 dark:bg-white/10 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-black text-carbon-900 dark:text-white">{value}</p>
      )}
      {description && <p className="text-[10px] text-carbon-600 dark:text-carbon-300 mt-1 font-medium">{description}</p>}
    </motion.div>
  )
}

function MiniKpi({ icon, label, value, loading, color }: {
  icon: React.ReactNode; label: string; value: string | number; loading: boolean; color?: string
}) {
  const textColor = color === 'red' ? 'text-alert-400' : color === 'amber' ? 'text-warn-400' : color === 'emerald' ? 'text-kuro-400' : 'text-carbon-900 dark:text-white'
  return (
    <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 flex items-center gap-3">
      <div className="p-1.5 rounded-lg bg-carbon-100 dark:bg-white/10 text-carbon-500 dark:text-carbon-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-carbon-600 dark:text-carbon-300 truncate">{label}</p>
        {loading ? (
          <div className="h-5 w-10 bg-carbon-100 dark:bg-white/10 rounded animate-pulse mt-0.5" />
        ) : (
          <p className={`text-lg font-black ${textColor}`}>{value}</p>
        )}
      </div>
    </div>
  )
}
