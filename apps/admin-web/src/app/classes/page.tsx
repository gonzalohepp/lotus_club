'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../layouts/AdminLayout'
import { Plus, Search } from 'lucide-react'
import ClassForm, { ClassRow } from '../components/classes/ClassForm'
import ClassCard from '../components/classes/ClassCard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ClassesPage() {
  const [items, setItems] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [color, setColor] = useState<'all' | 'blue' | 'red' | 'green' | 'purple' | 'orange' | 'pink'>('all')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select('id,name,instructor,days,start_time,end_time,capacity,max_students,color,description,price,created_at')
      .order('created_at', { ascending: false })
    if (!error && data) setItems(data as ClassRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return items.filter((c) => {
      const q = query.trim().toLowerCase()
      const inQuery =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        (c.instructor ?? '').toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q)
      const colorOk = color === 'all' || (c.color ?? 'blue') === color
      return inQuery && colorOk
    })
  }, [items, query, color])

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
    <AdminLayout>
      {/* Encabezado */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-slate-900">Gestión de Clases</h1>
          <p className="text-slate-600">Administra las clases disponibles en el gimnasio</p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Nueva Clase
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3"
            placeholder="Buscar por nombre o instructor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <select
          value={color}
          onChange={(e) => setColor(e.target.value as any)}
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 md:w-56"
        >
          <option value="all">Todos los colores</option>
          <option value="blue">Azul</option>
          <option value="red">Rojo</option>
          <option value="green">Verde</option>
          <option value="purple">Violeta</option>
          <option value="orange">Naranja</option>
          <option value="pink">Rosa</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-slate-500">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No hay clases para mostrar.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <ClassCard key={c.id} classItem={c} onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id!)} />
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowForm(false)} />
          <div className="relative z-10 w-full max-w-4xl p-4">
            <div className="rounded-2xl bg-white p-4 shadow-2xl">
              <ClassForm
                initial={editing}
                onCancel={() => setShowForm(false)}
                onSaved={async () => { setShowForm(false); await load() }}
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
