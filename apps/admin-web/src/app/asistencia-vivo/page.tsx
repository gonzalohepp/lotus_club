'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'
import {
    Users,
    Clock,
    User as UserIcon,
    CheckCircle,
    Activity,
    Zap,
    Calendar,
    AlertCircle,
    RefreshCw,
    X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { evaluateBilling } from '@/lib/billing'
import type { BillingConfig } from '@/lib/tenant/types'
import { todayAR } from '@/lib/dateUtils'
import { ClassIcon } from '../components/kuro/ClassIcon'

type ClassRow = {
    id: number
    name: string
    instructor: string | null
    start_time: string | null
    end_time: string | null
    days: string[] | null
    color: string | null
}

type AttendanceRecord = {
    user_id: string
    class_id: number
    profiles: {
        first_name: string | null
        last_name: string | null
        email: string | null
    }
    member_data?: {
        status: string | null
        next_payment_due: string | null
        role: string | null
        is_new_member?: boolean
    }
}

type AttendanceRaw = {
    user_id: string
    class_id: number
    profiles: AttendanceRecord['profiles'] | AttendanceRecord['profiles'][] | null
}

const DAY_MAP = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sáb']

/**
  * Etiquetas de estado del alumno. `billing` llega por parámetro porque esta es
  * una función de módulo, no un componente: no puede leer el contexto del tenant
  * con un hook. Sin ella caería a la política por defecto y mostraría "+20%" en
  * una sede que cobra otra cosa.
  */
const getMemberStatus = (a: AttendanceRecord, billing: BillingConfig | null, timezone?: string) => {
    const tags: { label: string; color: string; bg: string }[] = []
    if (!a.member_data) {
        return [{ label: 'Sin datos', color: 'text-carbon-500 dark:text-carbon-400', bg: 'bg-carbon-500/10' }]
    }
    const { status, next_payment_due, role, is_new_member } = a.member_data
    const isActive = status === 'activo'

    if (isActive) {
        tags.push({ label: 'Activo', color: 'text-kuro-500', bg: 'bg-kuro-500/10' })
        if (next_payment_due) {
            const due = new Date(next_payment_due + 'T12:00:00')
            if (new Date() > due) {
                tags.push({ label: 'Sin pago del mes', color: 'text-warn-500', bg: 'bg-warn-500/10' })
            }
        }
    } else {
        tags.push({ label: 'Vencido', color: 'text-alert-500', bg: 'bg-alert-500/10' })
    }

    const { multiplier, surchargePct } = evaluateBilling(billing, {
        endDate: next_payment_due,
        isNewMember: is_new_member ?? false,
        role,
        timezone,
    })
    if (multiplier > 1) {
        tags.push({ label: `+${surchargePct}% Recargo`, color: 'text-warn-500', bg: 'bg-warn-500/10' })
    }
    return tags
}

/* ── Bottom Sheet mobile ── */
function BottomSheet({
    open,
    onClose,
    cl,
    attendees,
}: {
    open: boolean
    onClose: () => void
    cl: ClassRow | null
    attendees: AttendanceRecord[]
}) {
    // Las reglas de cobro de la sede activa, para las etiquetas de recargo.
    const { billing, activeDojo } = useTenant()

    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, onClose])

    return (
        <AnimatePresence>
            {open && cl && (
                <>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        key="sheet"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-carbon-200 dark:border-white/10 rounded-t-[2rem] max-h-[80vh] flex flex-col"
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-white/20" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-carbon-200 dark:border-white/5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow shrink-0"
                                    style={{ backgroundColor: cl.color || '#899878' }}
                                >
                                    <ClassIcon name={cl.name} className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-carbon-900 dark:text-white uppercase tracking-tight">{cl.name}</p>
                                    <p className="text-[10px] text-kuro-400 font-bold uppercase tracking-widest">
                                        {cl.start_time?.slice(0, 5)} – {cl.end_time?.slice(0, 5)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-carbon-100 dark:bg-white/10 flex items-center justify-center shrink-0"
                            >
                                <X className="w-4 h-4 text-carbon-900 dark:text-white" />
                            </button>
                        </div>

                        {/* Lista scrollable */}
                        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
                            {attendees.length === 0 ? (
                                <div className="py-12 text-center">
                                    <p className="text-carbon-500 dark:text-carbon-400 font-bold italic text-sm">
                                        Aún no hay ingresos registrados.
                                    </p>
                                </div>
                            ) : (
                                attendees.map((a, idx) => {
                                    const tags = getMemberStatus(a, billing, activeDojo?.timezone)
                                    return (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.04 }}
                                            className="flex items-center gap-3 p-3 bg-carbon-50 dark:bg-white/5 rounded-2xl border border-carbon-200 dark:border-white/5"
                                        >
                                            <div className="w-9 h-9 rounded-xl bg-kuro-500/10 flex items-center justify-center font-black text-kuro-400 text-[11px] uppercase border border-kuro-500/20 shrink-0">
                                                {a.profiles?.first_name?.[0] || '?'}{a.profiles?.last_name?.[0] || ''}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-carbon-900 dark:text-white uppercase tracking-tight truncate">
                                                    {a.profiles?.first_name} {a.profiles?.last_name}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                    {tags.map((t, i) => (
                                                        <span key={i} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${t.bg} ${t.color}`}>
                                                            {t.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-carbon-200 dark:border-white/5 shrink-0">
                            <p className="text-center text-[10px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest">
                                {attendees.length} {attendees.length === 1 ? 'alumno presente' : 'alumnos presentes'}
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

/* ── Card de clase mobile ── */
function MobileClassCard({
    cl,
    attendees,
    currentTime,
    onTap,
}: {
    cl: ClassRow
    attendees: AttendanceRecord[]
    currentTime: Date
    onTap: () => void
}) {
    const [sH, sM] = (cl.start_time || '00:00').split(':').map(Number)
    const currMins = currentTime.getHours() * 60 + currentTime.getMinutes()
    const isAboutToStart = currMins < sH * 60 + sM

    return (
        <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={onTap}
            className="w-full text-left bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 rounded-2xl p-4 flex items-center gap-4 active:bg-carbon-50 dark:active:bg-white/10 transition-colors"
        >
            <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 shadow"
                style={{ backgroundColor: cl.color || '#899878' }}
            >
                <ClassIcon name={cl.name} className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-carbon-900 dark:text-white uppercase tracking-tight truncate">{cl.name}</p>
                    {isAboutToStart && (
                        <span className="px-1.5 py-0.5 rounded bg-warn-500/10 border border-warn-500/20 text-warn-400 text-[8px] font-black uppercase tracking-widest whitespace-nowrap">
                            Por iniciar
                        </span>
                    )}
                </div>
                <p className="text-[10px] text-kuro-400 font-bold uppercase tracking-widest mt-0.5">
                    {cl.start_time?.slice(0, 5)} – {cl.end_time?.slice(0, 5)}
                </p>
                {cl.instructor && (
                    <p className="text-[10px] text-carbon-500 dark:text-carbon-400 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                        <UserIcon className="w-2.5 h-2.5" />
                        {cl.instructor}
                    </p>
                )}
            </div>
            <div className="flex flex-col items-center justify-center bg-carbon-50 dark:bg-white/5 w-12 h-12 rounded-xl border border-carbon-200 dark:border-white/5 shrink-0">
                <span className="text-lg font-black text-carbon-900 dark:text-white leading-none">{attendees.length}</span>
                <span className="text-[7px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest">Pres.</span>
            </div>
        </motion.button>
    )
}

/* ── Página principal ── */
export default function AsistenciaVivoPage() {
    // La asistencia en vivo muestra quién está entrenando AHORA en esta sede.
    const { activeDojo, billing } = useTenant()
    const dojoId = activeDojo?.id

    const [classes, setClasses] = useState<ClassRow[]>([])
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [expandedClasses, setExpandedClasses] = useState<number[]>([])
    const [sheetClass, setSheetClass] = useState<ClassRow | null>(null)

    const toggleExpand = (id: number) => {
        setExpandedClasses(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const { data: clsData } = await supabase
                .from('classes')
                .select('*')
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .order('start_time')

            setClasses(clsData || [])

            const today = todayAR() // YYYY-MM-DD forzado Argentina
            const { data: attData } = await supabase
                .from('class_attendance')
                .select(`
                    user_id,
                    class_id,
                    profiles:user_id (first_name, last_name, email)
                `)
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .eq('date', today)

            const rawAttendance = ((attData as AttendanceRaw[]) || []).map(r => ({
                ...r,
                profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
            })) as AttendanceRecord[]

            if (rawAttendance.length > 0) {
                const userIds = Array.from(new Set(rawAttendance.map(r => r.user_id)))
                const { data: membersData } = await supabase
                    .from('members_with_status')
                    .select('user_id, status, next_payment_due, role, is_new_member')
                    .eq('dojo_id', dojoId ?? NO_DOJO)
                    .in('user_id', userIds)

                const memberMap = new Map<string, AttendanceRecord['member_data']>()
                membersData?.forEach(m => memberMap.set(m.user_id, m))

                setAttendance(rawAttendance.map(r => ({
                    ...r,
                    member_data: memberMap.get(r.user_id) ?? undefined
                })))
            } else {
                setAttendance([])
            }
        } catch (error) {
            console.error('Error fetching live data:', error)
        } finally {
            setLoading(false)
        }
    }, [dojoId])

    useEffect(() => {
        if (!dojoId) return
        fetchData()
        const channel = supabase
            .channel('live_attendance')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'class_attendance' }, fetchData)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [fetchData])

    const activeClasses = useMemo(() => {
        const dayName = DAY_MAP[currentTime.getDay()]
        const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
        return classes.filter(c => {
            if (!c.days?.includes(dayName) || !c.start_time || !c.end_time) return false
            const [sH, sM] = c.start_time.split(':').map(Number)
            const [eH, eM] = c.end_time.split(':').map(Number)
            return currentMinutes >= (sH * 60 + sM - 10) && currentMinutes <= (eH * 60 + eM + 15)
        })
    }, [classes, currentTime])

    const futureClasses = useMemo(() => {
        const dayName = DAY_MAP[currentTime.getDay()]
        const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
        return classes.filter(c => {
            if (!c.days?.includes(dayName) || !c.start_time) return false
            const [sH, sM] = c.start_time.split(':').map(Number)
            return (sH * 60 + sM) > currentMinutes + 10
        })
    }, [classes, currentTime])

    const sheetAttendees = useMemo(
        () => sheetClass ? attendance.filter(a => a.class_id === sheetClass.id) : [],
        [sheetClass, attendance]
    )

    return (
        <AdminLayout active="/asistencia-vivo">
            <div className="space-y-6 md:space-y-8">

                {/* Header */}
                <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-kuro-500 font-bold text-xs uppercase tracking-widest">
                            <Activity className="w-4 h-4 animate-pulse" />
                            Monitor en Tiempo Real
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
                            Asistencia <span className="text-kuro-600 dark:text-kuro-400">en Vivo</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex-1 md:flex-none bg-white dark:bg-white/5 backdrop-blur-xl border border-carbon-200 dark:border-white/10 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl">
                            <Clock className="w-4 h-4 text-kuro-500 shrink-0" />
                            <div>
                                <p className="text-[9px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest leading-none mb-0.5">Hora Actual</p>
                                <p className="text-lg font-black text-carbon-900 dark:text-white leading-none">
                                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchData}
                            className="p-3 bg-kuro-600 hover:bg-kuro-500 text-carbon-900 dark:text-white rounded-xl transition-all shadow-lg shadow-kuro-500/20 active:scale-95 shrink-0"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </header>

                {loading && classes.length === 0 ? (
                    <div className="min-h-[40vh] flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <Zap className="w-12 h-12 text-kuro-500 animate-pulse mx-auto" />
                            <p className="text-carbon-500 dark:text-carbon-400 font-black uppercase tracking-widest text-xs">Sincronizando dojo...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ══ MOBILE ══ */}
                        <div className="lg:hidden space-y-6">

                            {/* Clases en curso */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-kuro-500 animate-ping" />
                                    <h2 className="text-sm font-black text-carbon-900 dark:text-white uppercase tracking-tight">Clases en Curso</h2>
                                </div>

                                {activeClasses.length === 0 ? (
                                    <div className="p-8 text-center rounded-2xl border border-dashed border-carbon-200 dark:border-white/10">
                                        <AlertCircle className="w-8 h-8 text-carbon-700 mx-auto mb-3" />
                                        <p className="text-carbon-500 dark:text-carbon-400 font-bold text-xs uppercase tracking-widest italic">
                                            No hay clases en este momento
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {activeClasses.map(cl => (
                                            <MobileClassCard
                                                key={cl.id}
                                                cl={cl}
                                                attendees={attendance.filter(a => a.class_id === cl.id)}
                                                currentTime={currentTime}
                                                onTap={() => setSheetClass(cl)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Próximas clases */}
                            {futureClasses.length > 0 && (
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Calendar className="w-4 h-4 text-kuro-500" />
                                        <h2 className="text-sm font-black text-carbon-900 dark:text-white uppercase tracking-widest">Próximas Clases</h2>
                                    </div>
                                    <div className="space-y-2">
                                        {futureClasses.map(fcl => (
                                            <div
                                                key={fcl.id}
                                                className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/5"
                                            >
                                                <div
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                                                    style={{ backgroundColor: fcl.color || '#899878' }}
                                                >
                                                    <ClassIcon name={fcl.name} className="w-4 h-4 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-carbon-900 dark:text-white uppercase tracking-tight truncate">{fcl.name}</p>
                                                    <p className="text-[10px] text-carbon-500 dark:text-carbon-400 font-bold flex items-center gap-1 mt-0.5">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {fcl.start_time?.slice(0, 5)}
                                                    </p>
                                                </div>
                                                <span className="text-[9px] font-black text-carbon-600 dark:text-carbon-300 uppercase tracking-widest">Hoy</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* ══ DESKTOP ══ */}
                        <div className="hidden lg:grid lg:grid-cols-3 gap-8">

                            <div className="lg:col-span-2 space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-kuro-500 animate-ping" />
                                    <h2 className="text-lg font-black text-carbon-900 dark:text-white uppercase tracking-tight">Clases en Curso</h2>
                                </div>

                                {activeClasses.length === 0 ? (
                                    <div className="p-12 text-center rounded-[2.5rem] border-2 border-dashed border-carbon-200 dark:border-white/5 backdrop-blur-sm">
                                        <AlertCircle className="w-12 h-12 text-carbon-700 mx-auto mb-4" />
                                        <p className="text-carbon-500 dark:text-carbon-400 font-bold uppercase tracking-widest text-sm italic">No hay clases programadas para este momento</p>
                                        <p className="text-carbon-600 dark:text-carbon-300 text-[10px] mt-2 font-black uppercase tracking-tight">Monitorizando el siguiente horario...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {activeClasses.map((cl) => {
                                            const attendees = attendance.filter(a => a.class_id === cl.id)
                                            const isExpanded = expandedClasses.includes(cl.id)
                                            return (
                                                <motion.div
                                                    key={cl.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl"
                                                >
                                                    <button
                                                        onClick={() => toggleExpand(cl.id)}
                                                        className="w-full text-left p-6 flex items-center justify-between gap-4 hover:bg-white/5 transition-all"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div
                                                                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-lg"
                                                                style={{ backgroundColor: cl.color || '#899878' }}
                                                            >
                                                                <ClassIcon name={cl.name} className="w-5 h-5 text-white" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="text-xl font-black text-carbon-900 dark:text-white tracking-tight uppercase italic truncate">{cl.name}</h3>
                                                                    {(() => {
                                                                        const [sH, sM] = (cl.start_time || '00:00').split(':').map(Number)
                                                                        const currMins = currentTime.getHours() * 60 + currentTime.getMinutes()
                                                                        if (currMins < sH * 60 + sM) {
                                                                            return (
                                                                                <span className="px-2 py-0.5 rounded-lg bg-warn-500/10 border border-warn-500/20 text-warn-500 text-[8px] font-black uppercase tracking-widest whitespace-nowrap">
                                                                                    Por Iniciar
                                                                                </span>
                                                                            )
                                                                        }
                                                                        return null
                                                                    })()}
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <p className="text-carbon-500 dark:text-carbon-400 font-bold flex items-center gap-1 text-[9px] uppercase tracking-widest">
                                                                        <UserIcon className="w-2.5 h-2.5" />
                                                                        {cl.instructor || 'Sin Instructor'}
                                                                    </p>
                                                                    <span className="w-1 h-1 rounded-full bg-carbon-700" />
                                                                    <p className="text-kuro-500 font-bold flex items-center gap-1 text-[9px] uppercase tracking-widest">
                                                                        <Clock className="w-2.5 h-2.5" />
                                                                        {cl.start_time?.slice(0, 5)} - {cl.end_time?.slice(0, 5)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4 shrink-0">
                                                            <div className="flex flex-col items-center justify-center bg-carbon-50 dark:bg-white/5 w-14 h-14 rounded-2xl border border-carbon-200 dark:border-white/5">
                                                                <span className="text-lg font-black text-carbon-900 dark:text-white leading-none">{attendees.length}</span>
                                                                <span className="text-[8px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-widest">Pres.</span>
                                                            </div>
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border border-carbon-200 dark:border-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-carbon-100 dark:bg-white/10' : ''}`}>
                                                                <svg className="w-4 h-4 text-carbon-500 dark:text-carbon-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </button>

                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="p-6 pt-0 bg-black/20 border-t border-carbon-200 dark:border-white/5">
                                                                    <div className="pt-6 space-y-4">
                                                                        <p className="text-[9px] font-black text-carbon-500 dark:text-carbon-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                                                                            <CheckCircle className="w-3 h-3 text-kuro-500" />
                                                                            Listado de Alumnos
                                                                        </p>
                                                                        {attendees.length === 0 ? (
                                                                            <p className="text-carbon-600 dark:text-carbon-300 font-bold italic text-sm py-4">Aún no hay ingresos para esta clase.</p>
                                                                        ) : (
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                                {attendees.map((a, idx) => {
                                                                                    const tags = getMemberStatus(a, billing, activeDojo?.timezone)
                                                                                    return (
                                                                                        <motion.div
                                                                                            key={idx}
                                                                                            initial={{ opacity: 0, x: -5 }}
                                                                                            animate={{ opacity: 1, x: 0 }}
                                                                                            transition={{ delay: idx * 0.05 }}
                                                                                            className="flex items-center gap-3 p-3 bg-white/2 rounded-xl border border-carbon-200 dark:border-white/5 hover:bg-white/5 transition-colors"
                                                                                        >
                                                                                            <div className="w-8 h-8 rounded-lg bg-kuro-500/10 flex items-center justify-center font-black text-kuro-500 text-[10px] uppercase border border-kuro-500/20">
                                                                                                {a.profiles?.first_name?.[0] || '?'}{a.profiles?.last_name?.[0] || ''}
                                                                                            </div>
                                                                                            <div className="min-w-0 flex-1">
                                                                                                <p className="text-xs font-bold text-carbon-900 dark:text-white uppercase tracking-tight truncate leading-tight">
                                                                                                    {a.profiles?.first_name} {a.profiles?.last_name}
                                                                                                </p>
                                                                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                                                    {tags.map((t, idx2) => (
                                                                                                        <div key={idx2} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${t.bg} ${t.color} border border-carbon-200 dark:border-white/5 shadow-sm whitespace-nowrap`}>
                                                                                                            {t.label}
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </div>
                                                                                        </motion.div>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <aside className="space-y-6">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-kuro-500" />
                                    <h2 className="text-sm font-black text-carbon-900 dark:text-white uppercase tracking-widest">Próximas Clases</h2>
                                </div>
                                <div className="space-y-3">
                                    {futureClasses.length === 0 ? (
                                        <p className="text-carbon-600 dark:text-carbon-300 text-xs font-bold italic">No hay más clases por hoy.</p>
                                    ) : (
                                        futureClasses.map((fcl) => (
                                            <div
                                                key={fcl.id}
                                                className="p-5 rounded-3xl bg-white dark:bg-white/5 border border-carbon-200 dark:border-white/5 flex items-center gap-4 group hover:bg-white/5 transition-all"
                                            >
                                                <div
                                                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-lg"
                                                    style={{ backgroundColor: fcl.color || '#899878' }}
                                                >
                                                    <ClassIcon name={fcl.name} className="w-5 h-5 text-white" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-black text-carbon-900 dark:text-white uppercase tracking-tight truncate">{fcl.name}</p>
                                                    <p className="text-[10px] text-carbon-500 dark:text-carbon-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                                        <Clock className="w-3 h-3" />
                                                        {fcl.start_time?.slice(0, 5)}
                                                    </p>
                                                </div>
                                                <div className="text-[9px] font-black text-carbon-600 dark:text-carbon-300 uppercase tracking-widest group-hover:text-kuro-500 transition-colors">Hoy</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="p-8 rounded-2xl bg-gradient-to-br from-kuro-600 to-kuro-700 text-carbon-900 dark:text-white shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
                                        <Users className="w-24 h-24" />
                                    </div>
                                    <h3 className="text-lg font-black uppercase italic leading-none mb-2 relative z-10">Control Total</h3>
                                    <p className="text-kuro-100 text-xs font-bold leading-relaxed relative z-10">
                                        Este panel se actualiza automáticamente cuando un alumno valida su acceso en la entrada.
                                    </p>
                                </div>
                            </aside>
                        </div>
                    </>
                )}
            </div>

            {/* Bottom sheet — solo mobile */}
            <BottomSheet
                open={!!sheetClass}
                onClose={() => setSheetClass(null)}
                cl={sheetClass}
                attendees={sheetAttendees}
            />
        </AdminLayout>
    )
}