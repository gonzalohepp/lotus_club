'use client'

import { useEffect, useState, useMemo } from 'react'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
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

// Esta página usa una paleta oscura fija (no sigue el toggle de tema global),
// así que los StyledSelect acá se estilizan explícitamente para matchear ese
// fondo siempre-oscuro en vez de usar los tokens toggle-aware por default.
const darkSelectProps = {
    triggerClassName: 'bg-slate-950 border-slate-800 text-white font-bold appearance-none hover:bg-slate-950 focus-visible:ring-blue-500/50',
    contentClassName: 'bg-slate-900 border-slate-800',
    itemClassName: 'text-white focus:bg-slate-800',
}

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
                        <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest">
                            <TrendingDown className="w-4 h-4" />
                            Reportes
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                            Panel de <span className="text-blue-400">Reportes</span>
                        </h1>
                        <p className="text-slate-500 font-medium text-sm">
                            {activeTab === 'asistencia' ? 'Historial de asistencia con filtros avanzados.' : 'Miembros activos sin asistencia reciente.'}
                        </p>
                    </div>

                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/10 self-start md:self-center">
                        <button
                            onClick={() => setActiveTab('asistencia')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'asistencia'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            Asistencia
                        </button>
                        <button
                            onClick={() => setActiveTab('ausencia')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ausencia'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-slate-500 hover:text-slate-300'
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
            const { data: cls } = await supabase.from('classes').select('id, name, category').order('name')
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
        loadInitial()
    }, [])

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
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
                            }`}
                    >
                        {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Rango'}
                    </button>
                ))}
                {period === 'custom' && (
                    <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                            className="flex-1 sm:flex-none px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                        <span className="text-slate-600 text-xs font-bold">→</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                            className="flex-1 sm:flex-none px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                    </div>
                )}
                <div className="ml-auto">
                    <Button
                        onClick={handleExport}
                        disabled={filteredRecords.length === 0}
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-3 sm:px-4 py-5 font-bold text-xs uppercase tracking-widest transition-all gap-1.5 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        <FileDown className="w-4 h-4" />
                        <span className="hidden sm:inline">Excel</span>
                    </Button>
                </div>
            </div>

            {/* Filters row */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 md:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                    <StyledSelect
                        icon={Layers}
                        {...darkSelectProps}
                        value={filterClass}
                        onChange={(v) => { setFilterClass(v); setVisibleCount(50) }}
                        options={[
                            { value: 'all', label: 'Todas las clases' },
                            ...classes.map(c => ({ value: String(c.id), label: c.name })),
                        ]}
                    />
                    <StyledSelect
                        icon={Filter}
                        {...darkSelectProps}
                        value={filterMember}
                        onChange={(v) => { setFilterMember(v); setVisibleCount(50) }}
                        options={[
                            { value: 'all', label: 'Todos los alumnos' },
                            ...memberOptions.map(m => ({ value: m.id, label: m.name })),
                        ]}
                    />
                    <div className="relative sm:col-span-2 md:col-span-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 z-10" />
                        <input
                            type="text"
                            placeholder="Buscar alumno, email o clase..."
                            value={filterSearch}
                            onChange={(e) => { setFilterSearch(e.target.value); setVisibleCount(50) }}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Results count */}
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">
                {filteredRecords.length} registro{filteredRecords.length !== 1 ? 's' : ''} encontrado{filteredRecords.length !== 1 ? 's' : ''}
            </p>

            {/* Table */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                {loading ? (
                    <div className="p-16 text-center space-y-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full mx-auto" />
                        <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Cargando...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="hidden sm:table-header-group">
                                <tr className="border-b border-slate-800 bg-slate-800/50">
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha / Hora</th>
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Alumno</th>
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Clase</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {visibleRecords.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors block sm:table-row border-b border-slate-800/50 sm:border-0 py-2 sm:py-0">
                                        <td className="px-3 md:px-4 py-2 sm:py-3 block sm:table-cell">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest sm:hidden">Fecha</span>
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-sm">{new Date(r.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                <span className="text-[10px] text-slate-600 flex items-center gap-1 font-bold">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 md:px-4 py-2 sm:py-3 block sm:table-cell">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400 text-[10px] uppercase">{r.member_name?.[0]}</div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-white text-sm truncate">{r.member_name}</span>
                                                    <span className="text-[10px] text-slate-600 font-medium truncate">{r.member_email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 md:px-4 py-2 sm:py-3 block sm:table-cell">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-slate-700">{r.class_name}</span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredRecords.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-16 text-center">
                                            <Filter className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                                            <h3 className="text-lg font-bold text-white mb-1">Sin resultados</h3>
                                            <p className="text-slate-600 text-sm">No hay registros que coincidan con los filtros.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {filteredRecords.length > visibleCount && (
                            <div className="p-4 text-center border-t border-slate-800">
                                <button
                                    onClick={() => setVisibleCount(prev => prev + 50)}
                                    className="px-6 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
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

            if (!membersData) return

            const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
            const { data: logs } = await supabase
                .from('access_logs')
                .select('user_id, scanned_at')
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
        fetchData()
    }, [now])

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
                    className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl px-3 py-5 font-bold text-xs uppercase tracking-widest transition-all gap-1.5"
                >
                    <FileDown className="w-4 h-4 text-blue-400" />
                    <span className="hidden sm:inline">Excel</span>
                </Button>

                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm"
                    />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-2 right-3 opacity-10"><UserX className="w-12 h-12 text-red-500" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Total Ausentes (+7d)</p>
                    <p className="text-3xl font-black text-white">{absentMembers.length}</p>
                    <p className="text-[10px] text-red-500 font-bold mt-1">Requieren seguimiento</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-2 right-3 opacity-10"><Users className="w-12 h-12 text-blue-500" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Ratio de Ausencia</p>
                    <p className="text-3xl font-black text-white">
                        {members.length > 0 ? Math.round((absentMembers.length / members.length) * 100) : 0}%
                    </p>
                    <p className="text-[10px] text-blue-400 font-bold mt-1">Sobre miembros activos</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-2 right-3 opacity-10"><Calendar className="w-12 h-12 text-emerald-500" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Período de Análisis</p>
                    <p className="text-3xl font-black text-white">7+</p>
                    <p className="text-[10px] text-emerald-400 font-bold mt-1">Días sin registros</p>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center space-y-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full mx-auto" />
                        <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Analizando...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="hidden sm:table-header-group">
                                <tr className="border-b border-slate-800 bg-slate-800/50">
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Alumno</th>
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Última Asistencia</th>
                                    <th className="px-3 md:px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {absentMembers.map((m) => (
                                    <tr key={m.user_id} className="hover:bg-slate-800/30 transition-colors group block sm:table-row border-b border-slate-800/50 sm:border-0 py-2 sm:py-0">
                                        <td className="px-3 md:px-4 py-2 sm:py-4 block sm:table-cell">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-xs flex-shrink-0">{m.first_name?.[0]}{m.last_name?.[0]}</div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-white leading-tight uppercase tracking-tight text-sm truncate">{m.first_name} {m.last_name}</div>
                                                    <div className="text-slate-600 text-[10px] font-medium truncate">{m.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {m.last_access ? (
                                                <div className="space-y-0.5">
                                                    <div className="text-white font-bold text-sm">{new Date(m.last_access).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                    <div className="text-[10px] text-red-500 font-black uppercase tracking-widest">Hace {Math.floor((now - new Date(m.last_access).getTime()) / (1000 * 60 * 60 * 24))} días</div>
                                                </div>
                                            ) : (
                                                <div className="text-red-500 font-black text-xs uppercase tracking-widest">Sin registros</div>
                                            )}
                                        </td>
                                        <td className="px-3 md:px-4 py-2 sm:py-4 block sm:table-cell text-right sm:text-right">
                                            <Button
                                                variant="ghost"
                                                className="bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 rounded-xl px-3 sm:px-4 py-3 sm:py-4 font-bold text-xs uppercase tracking-widest transition-all gap-1.5"
                                                onClick={() => {
                                                    const msg = encodeURIComponent(`Hola ${m.first_name}, te extrañamos en Beleza Dojo! 🥋 Notamos que hace unos días no vienes a entrenar. ¿Todo bien?`)
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
                                            <Users className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                                            <h3 className="text-lg font-bold text-white mb-1">¡Sin ausencias críticas!</h3>
                                            <p className="text-slate-600 text-sm">Todos asistieron en la última semana.</p>
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
        blue: 'bg-blue-900/20 text-blue-400',
        indigo: 'bg-indigo-900/20 text-indigo-400',
        emerald: 'bg-emerald-900/20 text-emerald-400',
        amber: 'bg-amber-900/20 text-amber-400',
    }
    return (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
            <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 truncate">{label}</p>
                <p className="text-lg font-black text-white truncate">{value}</p>
                {sub && <p className="text-[9px] text-slate-600 font-bold">{sub}</p>}
            </div>
        </div>
    )
}
