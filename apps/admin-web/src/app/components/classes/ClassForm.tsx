import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Save, BookOpen, Clock, Calendar, Users, DollarSign, Type, Palette, AlignLeft, User } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export type ClassRow = {
  id?: number
  name: string
  instructor: string | null
  days: string[] | null
  start_time: string | null // "HH:mm"
  end_time: string | null   // "HH:mm"
  capacity: number | null
  max_students: number | null
  color: string | null
  description: string | null
  price_principal: number | null
  price_additional: number | null
  price?: number | null
  created_at?: string | null
}

type Props = {
  initial?: ClassRow | null
  onCancel: () => void
  onSaved?: () => void
}

const DAY_OPTIONS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sáb', 'Dom']
const COLOR_OPTIONS = [
  { label: 'Azul', value: 'blue', bg: 'bg-blue-500' },
  { label: 'Rojo', value: 'red', bg: 'bg-red-500' },
  { label: 'Verde', value: 'green', bg: 'bg-emerald-500' },
  { label: 'Violeta', value: 'purple', bg: 'bg-purple-500' },
  { label: 'Naranja', value: 'orange', bg: 'bg-orange-500' },
  { label: 'Rosa', value: 'pink', bg: 'bg-pink-500' },
]

function getInitialForm(initial?: ClassRow | null): ClassRow {
  if (initial) {
    return {
      name: initial.name ?? '',
      instructor: initial.instructor ?? '',
      days: initial.days ?? [],
      start_time: initial.start_time ?? '',
      end_time: initial.end_time ?? '',
      capacity: initial.capacity ?? initial.max_students ?? null,
      max_students: initial.max_students ?? initial.capacity ?? null,
      color: initial.color ?? 'blue',
      description: initial.description ?? '',
      price_principal: initial.price_principal ?? initial.price ?? null,
      price_additional: initial.price_additional ?? null,
      id: initial.id,
    }
  }
  return {
    name: '',
    instructor: '',
    days: [],
    start_time: '',
    end_time: '',
    capacity: null,
    max_students: null,
    color: 'blue',
    description: '',
    price_principal: null,
    price_additional: null,
  }
}

export default function ClassForm({ initial, onCancel, onSaved }: Props) {
  const initialForm = useMemo(() => getInitialForm(initial), [initial])
  const [form, setForm] = useState<ClassRow>(initialForm)
  const [saving, setSaving] = useState(false)

  const toggleDay = (d: string) => {
    const curr = new Set(form.days ?? [])
    if (curr.has(d)) curr.delete(d)
    else curr.add(d)
    setForm({ ...form, days: Array.from(curr) })
  }

  const save = async () => {
    if (!form.name.trim()) return
    if (form.price_principal === null || isNaN(Number(form.price_principal))) return

    setSaving(true)

    const payload = {
      name: form.name.trim(),
      instructor: form.instructor?.trim() || null,
      days: (form.days ?? []) as string[],
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      capacity: form.capacity ?? form.max_students ?? null,
      max_students: form.capacity ?? form.max_students ?? null,
      color: form.color || null,
      description: form.description?.trim() || null,
      price_principal: Number(form.price_principal),
      price_additional: form.price_additional === null ? null : Number(form.price_additional),
      price: Number(form.price_principal), // fallback for old views
    }

    const { error } = initial?.id
      ? await supabase.from('classes').update(payload).eq('id', initial.id)
      : await supabase.from('classes').insert(payload)

    setSaving(false)
    if (error) return alert('Error guardando clase: ' + error.message)
    onSaved?.()
  }

  const inputClass = "w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 pl-11 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all"

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Form */}
      <div className="shrink-0 bg-slate-900 px-10 py-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-blue-400 border border-white/10">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight uppercase leading-none">
              {initial?.id ? 'Editar Clase' : 'Ficha de Clase'}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Gestión de Actividades</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-10">
        <div className="grid gap-10 md:grid-cols-2">
          {/* General Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Type className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Información Base</h4>
            </div>

            <div className="space-y-4">
              <div className="relative group">
                <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nombre de la clase (ej: BJJ No-Gi) *"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="number"
                    value={form.price_principal ?? ''}
                    onChange={(e) => setForm({ ...form, price_principal: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="Precio Principal *"
                    className={inputClass}
                  />
                  <div className="absolute -bottom-5 left-1 text-[10px] font-bold text-blue-500 uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity">Valor Mensual Base</div>
                </div>

                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="number"
                    value={form.price_additional ?? ''}
                    onChange={(e) => setForm({ ...form, price_additional: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="Precio Adicional"
                    className={inputClass}
                  />
                  <div className="absolute -bottom-5 left-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity">Si se toma como 2da clase</div>
                </div>
              </div>

              <div className="relative group">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="number"
                  value={form.capacity ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value)
                    setForm({ ...form, capacity: v, max_students: v })
                  }}
                  placeholder="Capacidad máxima de alumnos"
                  className={inputClass}
                />
              </div>

              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  value={form.instructor ?? ''}
                  onChange={(e) => setForm({ ...form, instructor: e.target.value })}
                  placeholder="Instructor principal"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Schedule Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Calendar className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Días y Horarios</h4>
            </div>

            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Seleccionar Días</p>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((d) => {
                    const active = (form.days ?? []).includes(d)
                    return (
                      <motion.button
                        key={d}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleDay(d)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${active
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'
                          }`}
                      >
                        {d}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative group">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="time"
                    value={form.start_time ?? ''}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="relative group">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="time"
                    value={form.end_time ?? ''}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="relative group p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Cromática</span>
                </div>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm({ ...form, color: c.value })}
                      className={`w-8 h-8 rounded-full ${c.bg} transition-all ${form.color === c.value ? 'ring-4 ring-offset-2 ring-slate-900 scale-110 shadow-lg' : 'opacity-40 hover:opacity-100 scale-90'
                        }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Description Section */}
          <section className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <AlignLeft className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Presentación de la Actividad</h4>
            </div>

            <textarea
              rows={4}
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe los objetivos o requisitos de la clase..."
              className="w-full bg-slate-50 border border-slate-200 rounded-[24px] px-6 py-5 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all resize-none italic"
            />
          </section>
        </div>
      </div>

      {/* Footer Actions - Sticky */}
      <div className="shrink-0 p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-4">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={save}
          disabled={saving}
          className="flex-1 h-16 bg-blue-600 text-white rounded-[24px] font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
        >
          {saving ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {saving ? 'Procesando...' : 'Confirmar Clase'}
        </motion.button>

        <button
          onClick={onCancel}
          className="h-16 px-10 rounded-[24px] border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
