'use client'

import { useEffect, useState, useMemo } from 'react'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'
import {
    Users,
    UserX,
    Calendar,
    MessageSquare,
    Search,
    FileDown,
    Filter,
    Layers,
    Clock,
    TrendingDown,
    CalendarDays,
    Trophy,
    Hash,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import StyledSelect from '../components/common/StyledSelect'
import { exportToExcel } from '@/lib/excelExport'

/* ================= Tipos ================= */
interface AttendanceRecord {
    id: number; date: string; created_at: string; user_id: string
    class_id: number; class_name: string; class_category: string
    member_name: string; member_email: string
}
interface Member {
    user_id: string; first_name: string; last_name: string; email: string
    phone: string | null; status: string; next_payment_due: string | null
    role: string | null; last_access?: string
}

type PeriodFilter = 'today' | 'week' | 'month' | 'custom'

/* ================= Helpers ================= */
function todayStr() {
    const d = new Date()
    return d.toISOString().slice(0, 10)
}
function daysAgoStr(n: number) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
}
function startOfMonthStr() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/* ================= Página Principal ================= */

export default function ReportesPage() {
    const [activeTab, setActiveTab] = useState<'asistencia' | 'ausencia'>('asistencia')

    return (
        <AdminLayout active="/reportes">
            <div className="space-y-6">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-kuro-400 font-bold text-xs uppercase tracking-widest">
                            <TrendingDown className="w-4 h-4" />
                            Reportes
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
                            Panel de <span className="text-kuro-600 dark:text-kuro-400">Reportes</span>
                        </h1>
                        <p className="text-carbon-500 dark:text-carbon-400 font-medium text-sm">
                            {activeTab === 'asistencia' ? 'Historial de asistencia con filtros avanzados.' : 'Alumnos activos sin asistencia reciente.'}
                        </p>
                    </div>

                    <div className="flex bg-white dark:bg-white/5 p-1 rounded-xl border border-carbon-200 dark:border-white/10 self-start md:self-center">
                        <button
                            onClick={() => setActiveTab('asistencia')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'asistencia'
                                ? 'bg-kuro-600 text-carbon-900 dark:text-white shadow-lg shadow-kuro-500/20'
                                : 'text-carbon-500 dark:text-carbon-400 hover:text-carbon-300'
                                }`}
                        >
                            Asistencia
                        </button>
                        <button
                            onClick={() => setActiveTab('ausencia')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ausencia'
                                ? 'bg-kuro-600 text-carbon-900 dark:text-white shadow-lg shadow-kuro-500/20'
                                : 'text-carbon-500 dark:text-carbon-400 hover:text-carbon-300'
                                }`}
                        >
                            Ausencias
                        </button>
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {activeTab === 'asistencia' ? (
                        <motion.div key="asistencia" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                            <AsistenciaReport />
                        </motion.div>
                    ) : (
                        <motion.div key="ausencia" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                            <AusenciaReport />
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </AdminLayout>
    )
}

/* ================= Componente Reporte Asistencia ================= */

function AsistenciaReport() {
    // Reportes de asistencia de la sede activa.
    const { activeDojo } = useTenant()
    const dojoId = activeDojo?.id

    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [classes, setClasses] = useState<{ id: number, name: string, category: string }[]>([])

    // Filters
    const [filterClass, setFilterClass] = useState<string>('all')
    const [filterSearch, setFilterSearch] = useState('')
    const [filterMember, setFilterMember] = useState('all')
    const [period, setPeriod] = useState<PeriodFilter>('month')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [visibleCount, setVisibleCount] = useState(50)

    useEffect(() => {
        async function loadInitial() {
            setLoading(true)
            const { data: cls } = await supabase
                .from('classes')
                .select('id, name, category')
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .order('name')
            setClasses(cls || [])

            const { data: att, error } = await supabase
                .from('class_attendance')
                .select(`
                    id,
                    date,
                    created_at,
                    user_id,
                    class_id,
                    classes (name, category),
                    profiles:user_id (first_name, last_name, email)
                `)
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })

            if (!error) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mapped = (att as any[]).map(r => ({
                    id: r.id,
                    date: r.date,
                    created_at: r.created_at,
                    user_id: r.user_id,
                    class_id: r.class_id,
                    class_name: r.classes?.name || 'N/A',
                    class_category: r.classes?.category || 'artes-marciales',
                    member_name: `${r.profiles?.first_name || ''} ${r.profiles?.last_name || ''}`.trim() || 'Desconocido',
                    member_email: r.profiles?.email || ''
                }))
                setRecords(mapped)
            }
            setLoading(false)
        }
        if (!dojoId) return
        loadInitial()
    }, [dojoId])

    // Unique member names for filter
    const memberOptions = useMemo(() => {
        const map = new Map<string, string>()
        records.forEach(r => {
            if (r.member_name !== 'Desconocido' && !map.has(r.user_id)) {
                map.set(r.user_id, r.member_name)
            }
        })
        return Array.from(map.entries())
            .sort(([, a], [, b]) => a.localeCompare(b))
            .map(([id, name]) => ({ id, name }))
    }, [records])

    // Period date range
    const dateRange = useMemo((): { from: string; to: string } => {
        switch (period) {
            case 'today': return { from: todayStr(), to: todayStr() }
            case 'week': return { from: daysAgoStr(6), to: todayStr() }
            case 'month': return { from: startOfMonthStr(), to: todayStr() }
            case 'custom': return { from: customFrom || '2000-01-01', to: customTo || todayStr() }
        }
    }, [period, customFrom, customTo])

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const matchesClass = filterClass === 'all' || r.class_id === Number(filterClass)
            const matchesPeriod = r.date >= dateRange.from && r.date <= dateRange.to
            const matchesMember = filterMember === 'all' || r.user_id === filterMember
            const searchLower = filterSearch.toLowerCase()
            return matchesClass && matchesPeriod && matchesMember && (!filterSearch ||
                r.member_name.toLowerCase().includes(searchLower) ||
                r.member_email.toLowerCase().includes(searchLower) ||
                r.class_name.toLowerCase().includes(searchLower))
        })
    }, [records, filterClass, dateRange, filterMember, filterSearch])

    // Stats
    const stats = useMemo(() => {
        const uniqueUsers = new Set(filteredRecords.map(r => r.user_id))
        const classCounts: Record<string, number> = {}
        const dayCounts: Record<string, number> = {}
        filteredRecords.forEach(r => {
            classCounts[r.class_name] = (classCounts[r.class_name] ?? 0) + 1
            dayCounts[r.date] = (dayCounts[r.date] ?? 0) + 1
        })
        const topClass = Object.entries(classCounts).sort(([, a], [, b]) => b - a)[0]
        const topDay = Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0]
        return {
            total: filteredRecords.length,
            uniqueUsers: uniqueUsers.size,
            topClass: topClass ? topClass[0] : '-',
            topClassCount: topClass ? topClass[1] : 0,
            topDay: topDay ? new Date(topDay[0] + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '-',
            topDayCount: topDay ? topDay[1] : 0,
        }
    }, [filteredRecords])

    const visibleRecords = useMemo(() => filteredRecords.slice(0, visibleCount), [filteredRecords, visibleCount])

    const handleExport = () => {
        const dataToExport = filteredRecords.map(r => ({
            Fecha: r.date,
            Hora: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            Alumno: r.member_name,
            Email: r.member_email,
            Clase: r.class_name
        }))
        exportToExcel(dataToExport, `Reporte_Asistencia_${new Date().toISOString().slice(0, 10)}`)
    }

    return (
        <div className="space-y-5">
            {/* KPI Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<Hash className="w-4 h-4" />} label="Total Asistencias" value={stats.total} color="blue" />
                <StatCard icon={<Users className="w-4 h-4" />} label="Alumnos Únicos" value={stats.uniqueUsers} color="indigo" />
                <StatCard icon={<Trophy className="w-4 h-4" />} label="Clase Top" value={stats.topClass} sub={`${stats.topClassCount} asist.`} color="emerald" />
                <StatCard icon={<CalendarDays className="w-4 h-4" />} label="Día Top" value={stats.topDay} sub={`${stats.topDayCount} asist.`} color="amber" />
            </div>

            {/* Period Filter */}
            <div className="flex flex-wrap items-center gap-2">
                {(['today', 'week', 'month', 'custom'] as PeriodFilter[]).map(p => (
                    <button
                        key={p}
                        onClick={() => { setPeriod(p); setVisibleCount(50) }}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${period === p
                            ? 'bg-kuro-600 text-carbon-900 dark:text-white shadow-lg shadow-kuro-500/20'
                            : 'bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 text-carbon-500 dark:text-carbon-400 hover:text-white hover:border-carbon-600'
                            }`}
                    >
                        {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Rango'}
                    </button>
                ))}
                {period === 'custom' && (
                    <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                            className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 rounded-xl text-carbon-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-kuro-500/50" />
                        <span className="text-carbon-600 dark:text-carbon-300 text-xs font-bold">→</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                            className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 rounded-xl text-carbon-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-kuro-500/50" />
                    </div>
                )}
                <div className="ml-auto">
                    <Button
                        onClick={handleExport}
                        disabled={filteredRecords.length === 0}
                        className="bg-kuro-600 hover:bg-kuro-500 text-carbon-900 dark:text-white rounded-xl px-3 sm:px-4 py-5 font-bold text-xs uppercase tracking-widest transition-all gap-1.5 shadow-lg shadow-kuro-500/20 disabled:opacity-50"
                    >
                        <FileDown className="w-4 h-4" />
                        <span className="hidden sm:inline">Excel</span>
                    </Button>
                </div>
            </div>

            {/* Filters row */}
            <div className="rounded-xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 p-3 md:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                    <StyledSelect
                        icon={Layers}
                        value={filterClass}
                        onChange={(v) => { setFilterClass(v); setVisibleCount(50) }}
                        options={[
                            { value: 'all', label: 'Todas las clases' },
                            ...classes.map(c => ({ value: String(c.id), label: c.name })),
                        ]}
                    />
                    <StyledSelect
                        icon={Filter}
                        value={filterMember}
                        onChange={(v) => { setFilterMember(v); setVisibleCount(50) }}
                        options={[
                            { value: 'all', label: 'Todos los alumnos' },
                            ...memberOptions.map(m => ({ value: m.id, label: m.name })),
                        ]}
                    />
                    <div className="relative sm:col-span-2 md:col-span-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-carbon-600 dark:text-carbon-300 z-10" />
                        <input
                            type="text"
                            placeholder="Buscar alumno, email o clase..."
                            value={filterSearch}
                            onChange={(e) => { setFilterSearch(e.target.value); setVisibleCount(50) }}
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-carbon-200 dark:border-white/10 rounded-xl text-carbon-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-kuro-500/50 transition-all font-medium text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Results count */}
            <p className="text-xs text-carbon-600 dark:text-carbon-300 font-bold uppercase tracking-widest">
                {filteredRecords.length} registro{filteredRecords.length !== 1 ? 's' : ''} encontrado{filteredRecords.length !== 1 ? 's' : ''}
            </p>

            {/* Table */}
            <div className="rounded-xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 overflow-hidden">
                {loading ? (
                    <div className="p-16 text-center space-y-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-10 h-10 border-3 border-kuro-500/20 border-t-kuro-500 rounded-full mx-auto" />
                        <p className="text-carbon-600 dark:text-carbon-300 font-bold uppercase tracking-widest text-xs">Cargando...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="hidden sm:table-header-group">
                                <tr className="border-b border-carbon-200 dark:border-white/10 bg-carbon-100 dark:bg-white/10">
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest">Fecha / Hora</th>
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest">Alumno</th>
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest">Clase</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-carbon-800/50">
                                {visibleRecords.map((r) => (
                                    <tr key={r.id} className="hover:bg-carbon-800/30 transition-colors block sm:table-row border-b border-carbon-200 dark:border-white/10 sm:border-0 py-2 sm:py-0">
                                        <td className="px-3 md:px-4 py-2 sm:py-3 block sm:table-cell">
                                            <span className="text-[9px] font-black text-carbon-600 dark:text-carbon-300 uppercase tracking-widest sm:hidden">Fecha</span>
                                            <div className="flex flex-col">
                                                <span className="text-carbon-900 dark:text-white font-bold text-sm">{new Date(r.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                <span className="text-[10px] text-carbon-600 dark:text-carbon-300 flex items-center gap-1 font-bold">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 md:px-4 py-2 sm:py-3 block sm:table-cell">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-kuro-500/10 border border-kuro-500/20 flex items-center justify-center font-bold text-kuro-400 text-[10px] uppercase">{r.member_name?.[0]}</div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-carbon-900 dark:text-white text-sm truncate">{r.member_name}</span>
                                                    <span className="text-[10px] text-carbon-600 dark:text-carbon-300 font-medium truncate">{r.member_email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 md:px-4 py-2 sm:py-3 block sm:table-cell">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-carbon-100 dark:bg-white/10 text-carbon-300 text-[10px] font-black uppercase tracking-widest border border-carbon-200 dark:border-white/15">{r.class_name}</span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredRecords.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-16 text-center">
                                            <Filter className="w-12 h-12 text-carbon-800 mx-auto mb-3" />
                                            <h3 className="text-lg font-bold text-carbon-900 dark:text-white mb-1">Sin resultados</h3>
                                            <p className="text-carbon-600 dark:text-carbon-300 text-sm">No hay registros que coincidan con los filtros.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {filteredRecords.length > visibleCount && (
                            <div className="p-4 text-center border-t border-carbon-200 dark:border-white/10">
                                <button
                                    onClick={() => setVisibleCount(prev => prev + 50)}
                                    className="px-6 py-2.5 rounded-xl bg-carbon-100 dark:bg-white/10 border border-carbon-200 dark:border-white/15 text-carbon-900 dark:text-white text-xs font-black uppercase tracking-widest hover:bg-carbon-700 transition-all"
                                >
                                    Cargar más ({filteredRecords.length - visibleCount} restantes)
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ================= Componente Reporte Ausencia ================= */

function AusenciaReport() {
    // Reporte de ausentismo de la sede activa.
    const { activeDojo, branding, org } = useTenant()
    // Firma del mensaje que se le manda al alumno ausente.
    const marca = branding.display_name || org?.name || 'tu dojo'
    const dojoId = activeDojo?.id

    const [members, setMembers] = useState<Member[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [now] = useState(() => Date.now())

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data: membersData } = await supabase
                .from('members_with_status')
                .select('user_id, first_name, last_name, email, phone, status, next_payment_due, role')
                .eq('dojo_id', dojoId ?? NO_DOJO)

            if (!membersData) return

            const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
            const { data: logs } = await supabase
                .from('access_logs')
                .select('user_id, scanned_at')
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .eq('result', 'autorizado')
                .gt('scanned_at', thirtyDaysAgo)
                .order('scanned_at', { ascending: false })

            const lastAccessMap: Record<string, string> = {}
            logs?.forEach(log => {
                if (log.user_id && !lastAccessMap[log.user_id]) {
                    lastAccessMap[log.user_id] = log.scanned_at
                }
            })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const enrichedMembers = (membersData as any[])
                .filter(m => m.status === 'activo')
                .map(m => ({
                    ...m,
                    last_access: lastAccessMap[m.user_id]
                }))

            setMembers(enrichedMembers)
            setLoading(false)
        }
        if (!dojoId) return
        fetchData()
    }, [now, dojoId])

    const absentMembers = useMemo(() => {
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
        return members
            .filter(m => {
                if (!m.last_access) return true
                return new Date(m.last_access).getTime() < sevenDaysAgo
            })
            .filter(m =>
                (m.first_name + ' ' + m.last_name).toLowerCase().includes(search.toLowerCase()) ||
                m.email.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a, b) => {
                if (!a.last_access) return -1
                if (!b.last_access) return 1
                return new Date(a.last_access).getTime() - new Date(b.last_access).getTime()
            })
    }, [members, search, now])

    return (
        <div className="space-y-5">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    onClick={() => exportToExcel(absentMembers, `Ausencias_${new Date().toISOString().slice(0, 10)}`)}
                    className="bg-carbon-100 dark:bg-white/10 hover:bg-carbon-700 text-carbon-900 dark:text-white border border-carbon-200 dark:border-white/15 rounded-xl px-3 py-5 font-bold text-xs uppercase tracking-widest transition-all gap-1.5"
                >
                    <FileDown className="w-4 h-4 text-kuro-400" />
                    <span className="hidden sm:inline">Excel</span>
                </Button>

                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-carbon-600 dark:text-carbon-300" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 rounded-xl text-carbon-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-kuro-500/50 transition-all font-medium text-sm"
                    />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 relative overflow-hidden">
                    <div className="absolute top-2 right-3 opacity-10"><UserX className="w-12 h-12 text-alert-500" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-carbon-600 dark:text-carbon-300 mb-1">Total Ausentes (+7d)</p>
                    <p className="text-3xl font-black text-carbon-900 dark:text-white">{absentMembers.length}</p>
                    <p className="text-[10px] text-alert-500 font-bold mt-1">Requieren seguimiento</p>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 relative overflow-hidden">
                    <div className="absolute top-2 right-3 opacity-10"><Users className="w-12 h-12 text-kuro-500" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-carbon-600 dark:text-carbon-300 mb-1">Ratio de Ausencia</p>
                    <p className="text-3xl font-black text-carbon-900 dark:text-white">
                        {members.length > 0 ? Math.round((absentMembers.length / members.length) * 100) : 0}%
                    </p>
                    <p className="text-[10px] text-kuro-400 font-bold mt-1">Sobre alumnos activos</p>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 relative overflow-hidden">
                    <div className="absolute top-2 right-3 opacity-10"><Calendar className="w-12 h-12 text-kuro-500" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-carbon-600 dark:text-carbon-300 mb-1">Período de Análisis</p>
                    <p className="text-3xl font-black text-carbon-900 dark:text-white">7+</p>
                    <p className="text-[10px] text-kuro-400 font-bold mt-1">Días sin registros</p>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center space-y-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-10 h-10 border-3 border-kuro-500/20 border-t-kuro-500 rounded-full mx-auto" />
                        <p className="text-carbon-600 dark:text-carbon-300 font-bold uppercase tracking-widest text-xs">Analizando...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="hidden sm:table-header-group">
                                <tr className="border-b border-carbon-200 dark:border-white/10 bg-carbon-100 dark:bg-white/10">
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest">Alumno</th>
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest">Última Asistencia</th>
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-carbon-800/50">
                                {absentMembers.map((m) => (
                                    <tr key={m.user_id} className="hover:bg-carbon-800/30 transition-colors group block sm:table-row border-b border-carbon-200 dark:border-white/10 sm:border-0 py-2 sm:py-0">
                                        <td className="px-3 md:px-4 py-2 sm:py-4 block sm:table-cell">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-carbon-100 dark:bg-white/10 border border-carbon-200 dark:border-white/15 flex items-center justify-center font-bold text-kuro-400 text-xs flex-shrink-0">{m.first_name?.[0]}{m.last_name?.[0]}</div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-carbon-900 dark:text-white leading-tight uppercase tracking-tight text-sm truncate">{m.first_name} {m.last_name}</div>
                                                    <div className="text-carbon-600 dark:text-carbon-300 text-[10px] font-medium truncate">{m.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {m.last_access ? (
                                                <div className="space-y-0.5">
                                                    <div className="text-carbon-900 dark:text-white font-bold text-sm">{new Date(m.last_access).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                    <div className="text-[10px] text-alert-500 font-black uppercase tracking-widest">Hace {Math.floor((now - new Date(m.last_access).getTime()) / (1000 * 60 * 60 * 24))} días</div>
                                                </div>
                                            ) : (
                                                <div className="text-alert-500 font-black text-xs uppercase tracking-widest">Sin registros</div>
                                            )}
                                        </td>
                                        <td className="px-3 md:px-4 py-2 sm:py-4 block sm:table-cell text-right sm:text-right">
                                            <Button
                                                variant="ghost"
                                                className="bg-kuro-500/10 hover:bg-kuro-500 text-kuro-400 hover:text-white border border-kuro-500/20 rounded-xl px-3 sm:px-4 py-3 sm:py-4 font-bold text-xs uppercase tracking-widest transition-all gap-1.5"
                                                onClick={() => {
                                                    const msg = encodeURIComponent(`Hola ${m.first_name}, te extrañamos en ${marca}! Notamos que hace unos días no venís a entrenar. ¿Todo bien?`)
                                                    const phone = m.phone?.replace(/\D/g, '') || ''
                                                    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                                                }}
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                Contactar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {absentMembers.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-12 text-center">
                                            <Users className="w-12 h-12 text-carbon-800 mx-auto mb-3" />
                                            <h3 className="text-lg font-bold text-carbon-900 dark:text-white mb-1">¡Sin ausencias críticas!</h3>
                                            <p className="text-carbon-600 dark:text-carbon-300 text-sm">Todos asistieron en la última semana.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ================= Componente StatCard ================= */

function StatCard({ icon, label, value, sub, color }: {
    icon: React.ReactNode; label: string; value: string | number; sub?: string
    color: 'blue' | 'indigo' | 'emerald' | 'amber'
}) {
    const colorMap = {
        blue: 'bg-kuro-900/20 text-kuro-400',
        indigo: 'bg-kuro-900/20 text-kuro-400',
        emerald: 'bg-kuro-900/20 text-kuro-400',
        amber: 'bg-warn-900/20 text-warn-400',
    }
    return (
        <div className="p-4 rounded-xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
            <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-carbon-600 dark:text-carbon-300 truncate">{label}</p>
                <p className="text-lg font-black text-carbon-900 dark:text-white truncate">{value}</p>
                {sub && <p className="text-[9px] text-carbon-600 dark:text-carbon-300 font-bold">{sub}</p>}
            </div>
        </div>
    )
}
