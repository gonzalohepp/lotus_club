'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChartLine, Clock, GraduationCap } from 'lucide-react'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'
import { fmtDateShort, fmtSchedule } from '@/lib/format'
import { PageHeader, SectionCard, EmptyState } from '../components/kuro/Page'

/**
 * "Mis clases" — lo que da el instructor y quién fue.
 *
 * El instructor tenía QR, Validar, Mi Perfil y Asistencia en Vivo: podía ver
 * quién estaba entrenando EN ESE MOMENTO, pero no el historial de sus propias
 * clases. El detalle de asistencia vivía en /reportes, que es sólo de admin.
 *
 * Filtra por `instructor_id` / `secondary_instructor_id`, que existen desde que
 * el instructor de una clase dejó de ser texto libre. Un admin también entra
 * acá: en la mayoría de las academias además da clases.
 */

type ClassRow = {
    id: number
    name: string
    days: string[] | null
    start_time: string | null
    end_time: string | null
    color: string | null
    instructor_id: string | null
    secondary_instructor_id: string | null
}

type AttendanceRow = {
    date: string
    user_id: string
    class_id: number
    profiles: { first_name: string | null; last_name: string | null } | null
}

const nameOf = (p: AttendanceRow['profiles']) =>
    `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Sin nombre'

export default function MisClasesPage() {
    const { activeDojo, userId } = useTenant()
    const dojoId = activeDojo?.id

    const [classes, setClasses] = useState<ClassRow[]>([])
    const [attendance, setAttendance] = useState<AttendanceRow[]>([])
    const [selected, setSelected] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!dojoId || !userId) return

        const load = async () => {
            setLoading(true)

            // Mis clases: principal o secundario. `or` de PostgREST, no dos queries.
            const { data: cls } = await supabase
                .from('classes')
                .select('id,name,days,start_time,end_time,color,instructor_id,secondary_instructor_id')
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .or(`instructor_id.eq.${userId},secondary_instructor_id.eq.${userId}`)
                .order('name')

            const mine = (cls ?? []) as ClassRow[]
            setClasses(mine)
            setSelected((prev) => prev ?? mine[0]?.id ?? null)

            if (mine.length) {
                // Últimos 60 días: suficiente para ver constancia sin traer todo.
                const desde = new Date()
                desde.setDate(desde.getDate() - 60)

                const { data: att } = await supabase
                    .from('class_attendance')
                    .select('date, user_id, class_id, profiles:user_id (first_name, last_name)')
                    .eq('dojo_id', dojoId ?? NO_DOJO)
                    .in('class_id', mine.map((c) => c.id))
                    .gte('date', desde.toISOString().slice(0, 10))
                    .order('date', { ascending: false })

                setAttendance(
                    ((att ?? []) as unknown as AttendanceRow[]).map((r) => ({
                        ...r,
                        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
                    }))
                )
            } else {
                setAttendance([])
            }

            setLoading(false)
        }

        load()
    }, [dojoId, userId])

    const rows = useMemo(
        () => attendance.filter((a) => a.class_id === selected),
        [attendance, selected]
    )

    /** Asistencia agrupada por fecha: cada día de clase con quiénes fueron. */
    const sessions = useMemo(() => {
        const map = new Map<string, string[]>()
        for (const r of rows) {
            map.set(r.date, [...(map.get(r.date) ?? []), nameOf(r.profiles)])
        }
        return Array.from(map, ([date, names]) => ({ date, names: names.sort() }))
            .sort((a, b) => b.date.localeCompare(a.date))
    }, [rows])

    /** Ranking de constancia en el período. */
    const ranking = useMemo(() => {
        const counts = new Map<string, { name: string; n: number }>()
        for (const r of rows) {
            const prev = counts.get(r.user_id)
            counts.set(r.user_id, { name: nameOf(r.profiles), n: (prev?.n ?? 0) + 1 })
        }
        return Array.from(counts.values()).sort((a, b) => b.n - a.n)
    }, [rows])

    const current = classes.find((c) => c.id === selected)

    return (
        <AdminLayout active="/mis-clases">
            <PageHeader
                title="Mis clases"
                icon={<Clock className="w-4 h-4" />}
                subtitle={`Quién vino a las clases que doy · últimos 60 días`}
            />

            {loading ? (
                <EmptyState text="Cargando…" />
            ) : !classes.length ? (
                <SectionCard title="Sin clases asignadas" icon={<GraduationCap className="w-4 h-4" />}>
                    <EmptyState
                        icon={<GraduationCap className="w-8 h-8" />}
                        text="No figurás como instructor de ninguna clase de esta sede. Pedile al administrador que te asigne."
                    />
                </SectionCard>
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Mis clases */}
                    <div className="space-y-3">
                        {classes.map((c) => {
                            const isSel = c.id === selected
                            const total = attendance.filter((a) => a.class_id === c.id).length
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => setSelected(c.id)}
                                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${isSel
                                        ? 'border-[#899878] bg-[#899878]/10'
                                        : 'border-carbon-200 bg-white hover:border-[#899878]/50 dark:border-white/10 dark:bg-white/5'
                                        }`}
                                >
                                    <p className="font-bold text-carbon-900 dark:text-white">{c.name}</p>
                                    <p className="mt-1 text-[11px] font-medium text-carbon-500 dark:text-carbon-400">
                                        {fmtSchedule(c.days, c.start_time, c.end_time)}
                                    </p>
                                    <p className="mt-2 text-[11px] font-bold text-[#5F6E50] dark:text-[#899878]">
                                        {total} asistencia{total === 1 ? '' : 's'}
                                        {c.secondary_instructor_id === userId && ' · sos secundario'}
                                    </p>
                                </button>
                            )
                        })}
                    </div>

                    {/* Detalle */}
                    <div className="space-y-6 lg:col-span-2">
                        <SectionCard
                            title={current ? `Días de ${current.name}` : 'Días'}
                            hint="Quiénes fueron en cada clase"
                            icon={<CalendarDays className="w-4 h-4" />}
                        >
                            {!sessions.length ? (
                                <EmptyState text="Todavía no hay asistencias registradas en esta clase." />
                            ) : (
                                <div className="max-h-[420px] space-y-2 overflow-y-auto">
                                    {sessions.map((s) => (
                                        <div
                                            key={s.date}
                                            className="rounded-xl bg-carbon-50 p-3 dark:bg-white/5"
                                        >
                                            <div className="flex items-baseline justify-between gap-3">
                                                <p className="text-xs font-black uppercase tracking-widest text-carbon-900 dark:text-white">
                                                    {fmtDateShort(s.date)}
                                                </p>
                                                <span className="shrink-0 rounded-full bg-[#899878]/20 px-2 py-0.5 text-[11px] font-bold text-[#5F6E50] dark:text-[#899878]">
                                                    {s.names.length}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm text-carbon-600 dark:text-carbon-300">
                                                {s.names.join(' · ')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard
                            title="Constancia"
                            hint="Cuántas veces vino cada uno en el período"
                            icon={<ChartLine className="w-4 h-4" />}
                        >
                            {!ranking.length ? (
                                <EmptyState text="Sin datos en el período." />
                            ) : (
                                <div className="space-y-2">
                                    {ranking.map((r, i) => (
                                        <div
                                            key={r.name + i}
                                            className="flex items-center justify-between gap-3 rounded-xl bg-carbon-50 p-3 dark:bg-white/5"
                                        >
                                            <span className="flex min-w-0 items-center gap-3">
                                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-carbon-200 text-xs font-bold text-carbon-600 dark:bg-white/10 dark:text-carbon-300">
                                                    {i + 1}
                                                </span>
                                                <span className="truncate text-sm font-bold text-carbon-800 dark:text-carbon-200">
                                                    {r.name}
                                                </span>
                                            </span>
                                            <span className="shrink-0 rounded-full bg-[#899878]/20 px-2.5 py-1 text-xs font-black text-[#5F6E50] dark:text-[#899878]">
                                                {r.n}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
