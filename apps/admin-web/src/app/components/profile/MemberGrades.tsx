'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Trash, Award, Calendar, User, Save, X } from 'lucide-react'
import { fmtDateShort } from '@/lib/format'
import StyledSelect from '../common/StyledSelect'

type Grade = {
    id: string
    grade: string
    awarded_at: string
    notes: string | null
    instructor: {
        first_name: string
        last_name: string
    } | {
        first_name: string
        last_name: string
    }[] | null
}

const BELT_COLORS: Record<string, { bg: string, text: string, border: string, dot: string }> = {
    'blanco': { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-200', dot: 'bg-slate-300' },
    'azul': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-400/30', dot: 'bg-blue-300' },
    'púrpura': { bg: 'bg-purple-700', text: 'text-white', border: 'border-purple-400/30', dot: 'bg-purple-300' },
    'morado': { bg: 'bg-purple-700', text: 'text-white', border: 'border-purple-400/30', dot: 'bg-purple-300' },
    'marrón': { bg: 'bg-amber-900', text: 'text-white', border: 'border-amber-700/30', dot: 'bg-amber-400' },
    'negro': { bg: 'bg-slate-950', text: 'text-white', border: 'border-red-900/50', dot: 'bg-red-600' },
}

const BELT_OPTIONS = [
    'Blanco',
    'Blanco Grado 1', 'Blanco Grado 2', 'Blanco Grado 3', 'Blanco Grado 4',
    'Azul',
    'Azul Grado 1', 'Azul Grado 2', 'Azul Grado 3', 'Azul Grado 4',
    'Morado',
    'Morado Grado 1', 'Morado Grado 2', 'Morado Grado 3', 'Morado Grado 4',
    'Marrón',
    'Marrón Grado 1', 'Marrón Grado 2', 'Marrón Grado 3', 'Marrón Grado 4',
    'Negro',
    'Negro Grado 1', 'Negro Grado 2', 'Negro Grado 3', 'Negro Grado 4',
]

export default function MemberGrades({ userId, readOnly = false }: { userId: string, readOnly?: boolean }) {
    const [grades, setGrades] = useState<Grade[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)

    // Form state
    const [newGrade, setNewGrade] = useState('')
    const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
    const [newNotes, setNewNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const fetchGrades = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('member_grades')
                .select(`
                    id, grade, awarded_at, notes,
                    instructor:profiles!member_grades_instructor_id_fkey(first_name, last_name)
                `)
                .eq('user_id', userId)
                .order('awarded_at', { ascending: false })

            if (error) throw error
            setGrades(data as Grade[])
        } catch (error) {
            console.error('Error fetching grades:', error)
            import('sonner').then(({ toast }) => toast.error('Error al cargar graduaciones'))
        } finally {
            setLoading(false)
        }
    }, [userId])

    useEffect(() => {
        fetchGrades()
    }, [fetchGrades])

    const getBeltStyle = (name: string) => {
        const lower = (name || '').toLowerCase()
        for (const [key, value] of Object.entries(BELT_COLORS)) {
            if (lower.includes(key)) return value
        }
        return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-900 dark:text-white', border: 'border-slate-200 dark:border-slate-700', dot: 'bg-slate-400' }
    }

    const handleAdd = async () => {
        if (!newGrade) return
        setSubmitting(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No authenticado')

            const { error } = await supabase
                .from('member_grades')
                .insert({
                    user_id: userId,
                    grade: newGrade,
                    awarded_at: newDate,
                    notes: newNotes,
                    instructor_id: user.id
                })

            if (error) throw error

            const { toast } = await import('sonner')
            toast.success('Graduación registrada con éxito')
            setShowAdd(false)
            setNewGrade('')
            setNewNotes('')
            fetchGrades()
        } catch (error) {
            console.error('Error saving grade:', error)
            const { toast } = await import('sonner')
            const msg = error instanceof Error ? error.message : 'Error desconocido'
            toast.error('Error al guardar graduación', { description: msg })
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta graduación?')) return
        try {
            const { error } = await supabase.from('member_grades').delete().eq('id', id)
            if (error) throw error

            const { toast } = await import('sonner')
            toast.success('Graduación eliminada')
            fetchGrades()
        } catch (error) {
            console.error('Error deleting grade:', error)
            const { toast } = await import('sonner')
            toast.error('No se pudo eliminar la graduación')
        }
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cargando historial...</p>
        </div>
    )

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <Award className="w-6 h-6 text-blue-500" />
                        </div>
                        Historial de Graduaciones
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Trayectoria y ascensos del alumno</p>
                </div>
                {!readOnly && (
                    <button
                        onClick={() => setShowAdd(true)}
                        className="group flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 active:scale-95"
                    >
                        <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                        Nueva Graduación
                    </button>
                )}
            </div>

            {/* Form */}
            <AnimatePresence>
                {!readOnly && showAdd && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative z-20"
                    >
                        <div className="bg-white dark:bg-slate-900 rounded-[24px] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Registrar nuevo ascenso</h4>
                                <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Grado / Cinturón</label>
                                    <StyledSelect
                                        value={newGrade}
                                        onChange={setNewGrade}
                                        placeholder="Seleccionar Grado..."
                                        triggerClassName="h-12 rounded-2xl bg-slate-50 dark:bg-slate-950"
                                        options={[
                                            ...BELT_OPTIONS.map(opt => ({ value: opt, label: opt })),
                                            { value: 'OTRO', label: 'Otro...' },
                                        ]}
                                    />
                                    {newGrade === 'OTRO' && (
                                        <input
                                            type="text"
                                            placeholder="Especificar grado..."
                                            className="w-full h-12 px-4 mt-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold transition-all"
                                            onChange={e => setNewGrade(e.target.value)}
                                        />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fecha de Entrega</label>
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={e => setNewDate(e.target.value)}
                                        className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notas del Instructor</label>
                                <textarea
                                    value={newNotes}
                                    onChange={e => setNewNotes(e.target.value)}
                                    placeholder="Comentarios sobre el rendimiento o el examen..."
                                    className="w-full h-28 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium resize-none transition-all"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={handleAdd}
                                    disabled={!newGrade || submitting}
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {submitting ? 'Guardando...' : <><Save className="w-4 h-4" /> Registrar Ascenso</>}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* List */}
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                {grades.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-950/20 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800 ml-10">
                        <Award className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay graduaciones registradas aún.</p>
                    </div>
                ) : (
                    grades.map((g, i) => {
                        const style = getBeltStyle(g.grade)
                        const isLatest = i === 0
                        return (
                            <motion.div
                                key={g.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="relative pl-12 group"
                            >
                                {/* Timeline Dot */}
                                <div className={`absolute left-0 top-3 w-10 h-10 rounded-full border-4 border-white dark:border-slate-950 shadow-lg flex items-center justify-center z-10 ${style.bg} ${style.border}`}>
                                    <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                                </div>

                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none hover:border-blue-500/50 transition-all duration-300">
                                    <div className="p-6 md:p-8">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    {isLatest && (
                                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${style.bg} ${style.text} ${style.border} border shadow-sm`}>
                                                            Grado Actual
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-tighter">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {fmtDateShort(g.awarded_at)}
                                                    </span>
                                                </div>
                                                <h4 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                                                    {g.grade}
                                                </h4>
                                                {(() => {
                                                    const p = Array.isArray(g.instructor) ? g.instructor[0] : g.instructor
                                                    return p ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-100 dark:border-slate-700/50">
                                                            <User className="w-3 h-3 text-blue-500" />
                                                            Entregado por {p.first_name} {p.last_name}
                                                        </div>
                                                    ) : null
                                                })()}
                                            </div>

                                            {!readOnly && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDelete(g.id)
                                                    }}
                                                    className="relative z-50 inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white pointer-events-auto"
                                                >
                                                    <Trash className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>

                                        {g.notes && (
                                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                                <p className="text-sm md:text-base font-medium text-slate-600 dark:text-slate-400 italic bg-blue-50/30 dark:bg-blue-900/10 p-4 md:p-6 rounded-2xl border-l-4 border-blue-500/50">
                                                    &quot;{g.notes}&quot;
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
