'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminLayout from '../layouts/AdminLayout'
import { Plus, Search, BookOpen, Layers } from 'lucide-react'
import ClassForm, { ClassRow } from '../components/classes/ClassForm'
import ClassCard from '../components/classes/ClassCard'
import StyledSelect from '../components/common/StyledSelect'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'

export default function ClassesPage() {
  // Sede activa: las clases son de un dojo, no de la marca. RLS deja ver todas
  // las sedes a las que tenés acceso, así que sin este filtro un superadmin
  // vería las clases de todas sus sucursales mezcladas en una sola grilla.
  const { activeDojo } = useTenant()
  const dojoId = activeDojo?.id

  const [items, setItems] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'artes-marciales' | 'acondicionamiento-fisico'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6

  const fetchClasses = useCallback(() => {
    return supabase
      .from('classes')
      .select('id,name,instructor,instructor_id,secondary_instructor,secondary_instructor_id,days,start_time,end_time,capacity,max_students,color,category,description,price,price_principal,price_additional,created_at')
      .eq('dojo_id', dojoId ?? NO_DOJO)
      .order('name', { ascending: true })
  }, [dojoId])

  const load = useCallback(async () => {
    const { data, error } = await fetchClasses()
    if (!error && data) setItems(data as ClassRow[])
    setLoading(false)
  }, [fetchClasses])

  // Fetch inline (en vez de llamar a `load`) para que el setState quede
  // dentro del .then(), no colgando directo del cuerpo del effect.
  useEffect(() => {
    if (!dojoId) return
    let ignore = false
    fetchClasses().then(({ data, error }) => {
      if (ignore) return
      if (!error && data) setItems(data as ClassRow[])
      setLoading(false)
    })
    return () => { ignore = true }
  }, [fetchClasses, dojoId])

  const filtered = useMemo(() => {
    return items.filter((c) => {
      const q = query.trim().toLowerCase()
      const inQuery =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        (c.instructor ?? '').toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q)
      const colorOk = colorFilter === 'all' || (c.color ?? 'blue') === colorFilter
      const categoryOk = categoryFilter === 'all' || (c.category ?? 'artes-marciales') === categoryFilter
      return inQuery && colorOk && categoryOk
    })
  }, [items, query, colorFilter, categoryFilter])

  // No separate useEffect needed for pagination reset

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)

  const onCreate = () => { setEditing(null); setShowForm(true) }
  const onEdit = (row: ClassRow) => { setEditing(row); setShowForm(true) }

  const onDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta clase?')) return
    // El `.eq('dojo_id')` es redundante con RLS pero explicita el alcance: esta
    // pantalla sólo borra clases de la sede en la que estás parado.
    const { error } = await supabase.from('classes').delete().eq('id', id).eq('dojo_id', dojoId ?? NO_DOJO)
    if (error) {
      alert('Error eliminando clase: ' + error.message)
      return
    }
    setLoading(true)
    await load()
  }

  return (
    <AdminLayout active="/classes">
      {/* Background Decor */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-kuro-500/5 blur-[120px]" />
        <div className="absolute -right-[5%] bottom-[5%] h-[30%] w-[30%] rounded-full bg-kuro-500/5 blur-[100px]" />
      </div>

      <div className="relative">
        {/* Header Section */}
        <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center rounded-full bg-kuro-50 dark:bg-kuro-900/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-kuro-600 dark:text-kuro-400 ring-1 ring-inset ring-kuro-600/20 dark:ring-kuro-400/20">
                Administración
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
              Gestión de <span className="text-kuro-600 dark:text-kuro-400">Clases</span>
            </h1>
            <p className="max-w-md text-carbon-500 dark:text-carbon-400 font-medium">
              Horarios, instructores y disponibilidad de las actividades del Dojo.
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCreate}
            className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-kuro-600 px-6 py-3 text-white shadow-xl shadow-kuro-500/25 transition-all hover:bg-kuro-700"
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
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-carbon-400 group-focus-within:text-kuro-600 transition-colors" />
            <input
              type="text"
              className="h-14 w-full rounded-2xl border border-carbon-200 dark:border-carbon-700 bg-white dark:bg-carbon-800 text-carbon-900 dark:text-white pl-12 pr-4 font-medium shadow-sm outline-none ring-kuro-500/10 transition-all focus:border-kuro-500/50 focus:ring-4"
              placeholder="Buscar por nombre, instructor o descripción..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <StyledSelect
              wrapperClassName="min-w-[200px]"
              triggerClassName="h-14 rounded-2xl"
              icon={Layers}
              value={categoryFilter}
              onChange={(v) => { setCategoryFilter(v as 'all' | 'artes-marciales' | 'acondicionamiento-fisico'); setCurrentPage(1) }}
              options={[
                { value: 'all', label: 'Todas las Categorías' },
                { value: 'artes-marciales', label: 'Artes Marciales' },
                { value: 'acondicionamiento-fisico', label: 'Fisico' },
              ]}
            />

            <StyledSelect
              wrapperClassName="min-w-[180px]"
              triggerClassName="h-14 rounded-2xl"
              value={colorFilter}
              onChange={(v) => { setColorFilter(v); setCurrentPage(1) }}
              options={[
                { value: 'all', label: 'Todos los colores' },
                { value: 'blue', label: 'Azul' },
                { value: 'red', label: 'Rojo' },
                { value: 'green', label: 'Verde' },
                { value: 'purple', label: 'Violeta' },
                { value: 'orange', label: 'Naranja' },
                { value: 'pink', label: 'Rosa' },
                { value: 'amber', label: 'Ámbar' },
                { value: 'teal', label: 'Teal' },
                { value: 'cyan', label: 'Cian' },
                { value: 'indigo', label: 'Indigo' },
                { value: 'rose', label: 'Rose' },
              ]}
            />
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
              className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-carbon-200 bg-white/50 backdrop-blur-sm"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-kuro-500/20 border-t-kuro-500" />
              <p className="mt-4 text-sm font-black uppercase tracking-widest text-carbon-400">Actualizando Clases...</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-carbon-200 bg-white/50 backdrop-blur-sm px-6 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-carbon-50 flex items-center justify-center text-carbon-300 mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-carbon-900">No se encontraron clases</h3>
              <p className="text-carbon-500 max-w-xs mt-1">Ajusta los filtros o crea una nueva clase para empezar.</p>
            </motion.div>
          ) : (
            <div className="space-y-12">
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
              >
                {paginatedItems.map((item, idx) => (
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

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-8">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="h-12 w-12 rounded-xl border border-carbon-200 flex items-center justify-center text-carbon-600 disabled:opacity-30 hover:bg-carbon-50 transition-all font-bold"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`h-12 w-12 rounded-xl font-black text-xs transition-all ${currentPage === i + 1
                        ? 'bg-kuro-600 text-white shadow-lg shadow-kuro-500/20'
                        : 'bg-white border border-carbon-200 text-carbon-500 hover:border-carbon-400'
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="h-12 w-12 rounded-xl border border-carbon-200 flex items-center justify-center text-carbon-600 disabled:opacity-30 hover:bg-carbon-50 transition-all font-bold"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
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
              className="absolute inset-0 bg-carbon-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl h-full max-h-[85vh] flex flex-col"
            >
              <div className="flex-1 rounded-2xl bg-white shadow-2xl overflow-hidden">
                <ClassForm
                  initial={editing}
                  onCancel={() => setShowForm(false)}
                  onSaved={async () => {
                    setShowForm(false)
                    setLoading(true)
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
            <div className="flex items-center gap-3 rounded-xl bg-carbon-900 px-6 py-3 text-white shadow-2xl">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kuro-500">
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
