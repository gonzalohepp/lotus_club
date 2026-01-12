'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminLayout from '../layouts/AdminLayout'
import { Plus, Search, BookOpen, Layers } from 'lucide-react'
import ClassForm, { ClassRow } from '../components/classes/ClassForm'
import ClassCard from '../components/classes/ClassCard'
import { supabase } from '@/lib/supabaseClient'

export default function ClassesPage() {
  const [items, setItems] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<'all' | 'blue' | 'red' | 'green' | 'purple' | 'orange' | 'pink'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select('id,name,instructor,days,start_time,end_time,capacity,max_students,color,description,price,price_principal,price_additional,created_at')
      .order('name', { ascending: true })
    if (!error && data) setItems(data as ClassRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    return items.filter((c) => {
      const q = query.trim().toLowerCase()
      const inQuery =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        (c.instructor ?? '').toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q)
      const colorOk = colorFilter === 'all' || (c.color ?? 'blue') === colorFilter
      return inQuery && colorOk
    })
  }, [items, query, colorFilter])

  const onCreate = () => { setEditing(null); setShowForm(true) }
  const onEdit = (row: ClassRow) => { setEditing(row); setShowForm(true) }

  const onDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta clase?')) return
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) {
      alert('Error eliminando clase: ' + error.message)
      return
    }
    await load()
  }

  return (
    <AdminLayout active="/classes">
      {/* Background Decor */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-blue-500/5 blur-[120px]" />
        <div className="absolute -right-[5%] bottom-[5%] h-[30%] w-[30%] rounded-full bg-indigo-500/5 blur-[100px]" />
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
              <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-400/20">
                Administración
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
              Gestión de <span className="text-blue-600 dark:text-blue-400">Clases</span>
            </h1>
            <p className="max-w-md text-slate-500 dark:text-slate-400 font-medium">
              Horarios, instructores y disponibilidad de las actividades del Dojo.
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCreate}
            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-blue-600 px-8 py-4 text-white shadow-xl shadow-blue-500/25 transition-all hover:bg-blue-700"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <Plus className="h-6 w-6" />
            <span className="text-sm font-black uppercase tracking-widest">Nueva Clase</span>
          </motion.button>
        </header>

        {/* Filters Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12 flex flex-col gap-5 md:flex-row md:items-center"
        >
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="text"
              className="h-14 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white pl-12 pr-4 font-medium shadow-sm outline-none ring-blue-500/10 transition-all focus:border-blue-500/50 focus:ring-4"
              placeholder="Buscar por nombre, instructor o descripción..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <div className="relative min-w-[200px]">
              <Layers className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={colorFilter}
                onChange={(e) => setColorFilter(e.target.value as typeof colorFilter)}
                className="h-14 w-full appearance-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-11 pr-10 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none ring-blue-500/10 transition-all focus:border-blue-500/50 focus:ring-4"
              >
                <option value="all">Todos los colores</option>
                <option value="blue">Azul</option>
                <option value="red">Rojo</option>
                <option value="green">Verde</option>
                <option value="purple">Violeta</option>
                <option value="orange">Naranja</option>
                <option value="pink">Rosa</option>
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Data Grid */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-64 flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-white/50 backdrop-blur-sm"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500" />
              <p className="mt-4 text-sm font-black uppercase tracking-widest text-slate-400">Actualizando Clases...</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-64 flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-white/50 backdrop-blur-sm px-6 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">No se encontraron clases</h3>
              <p className="text-slate-500 max-w-xs mt-1">Ajusta los filtros o crea una nueva clase para empezar.</p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <ClassCard
                    classItem={item}
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item.id!)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal View */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl h-full max-h-[85vh] flex flex-col"
            >
              <div className="flex-1 rounded-[32px] bg-white shadow-2xl overflow-hidden">
                <ClassForm
                  initial={editing}
                  onCancel={() => setShowForm(false)}
                  onSaved={async () => {
                    setShowForm(false)
                    await load()
                    setShowSuccess(true)
                    setTimeout(() => setShowSuccess(false), 3000)
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-10 left-1/2 z-[200] -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-white shadow-2xl">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
                <Plus className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-black uppercase tracking-widest text-white">¡Clase Guardada!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
