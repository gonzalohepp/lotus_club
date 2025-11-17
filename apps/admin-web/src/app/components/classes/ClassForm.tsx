'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { X, Save } from 'lucide-react'

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
  price: number | null
  created_at?: string | null
}

type Props = {
  initial?: ClassRow | null
  onCancel: () => void
  onSaved?: () => void   // 👈 ahora es opcional
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAY_OPTIONS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function ClassForm({ initial, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<ClassRow>({
    name: '',
    instructor: '',
    days: [],
    start_time: '',
    end_time: '',
    capacity: null,
    max_students: null,
    color: 'blue',
    description: '',
    price: null,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? '',
        instructor: initial.instructor ?? '',
        days: initial.days ?? [],
        start_time: initial.start_time ?? '',
        end_time: initial.end_time ?? '',
        capacity: initial.capacity ?? initial.max_students ?? null,
        max_students: initial.max_students ?? initial.capacity ?? null,
        color: initial.color ?? 'blue',
        description: initial.description ?? '',
        price: initial.price ?? null,
        id: initial.id,
      })
    }
  }, [initial])

  const toggleDay = (d: string) => {
    const curr = new Set(form.days ?? [])
    if (curr.has(d)) curr.delete(d)
    else curr.add(d)
    setForm({ ...form, days: Array.from(curr) })
  }

  const save = async () => {
    if (!form.name.trim()) {
      alert('El nombre de la clase es obligatorio')
      return
    }
    if (form.price === null || isNaN(Number(form.price))) {
      alert('El precio mensual es obligatorio')
      return
    }

    setSaving(true)

    const payload = {
      name: form.name.trim(),
      instructor: form.instructor?.trim() || null,
      days: (form.days ?? []) as string[],
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      capacity: form.capacity ?? form.max_students ?? null,
      max_students: form.capacity ?? form.max_students ?? null, // sincronizamos
      color: form.color || null,
      description: form.description?.trim() || null,
      price: Number(form.price),
    }

    if (initial?.id) {
      const { error } = await supabase.from('classes').update(payload).eq('id', initial.id)
      setSaving(false)
      if (error) return alert('Error actualizando clase: ' + error.message)
      onSaved?.() // 👈 seguro
    } else {
      const { error } = await supabase.from('classes').insert(payload)
      setSaving(false)
      if (error) return alert('Error creando clase: ' + error.message)
      onSaved?.() // 👈 seguro
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          {initial?.id ? 'Editar Clase' : 'Nueva Clase'}
        </h3>
        <button onClick={onCancel} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Cerrar">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Nombre */}
        <div className="space-y-1.5">
          <label className="text-sm text-slate-600">Nombre de la Clase *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: BJJ Turno Noche"
            className="h-11 w-full rounded-lg border border-slate-300 px-3"
          />
        </div>

        {/* Precio */}
        <div className="space-y-1.5">
          <label className="text-sm text-slate-600">Precio Mensual *</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={form.price ?? ''}
            onChange={(e) =>
              setForm({ ...form, price: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="40000"
            className="h-11 w-full rounded-lg border border-slate-300 px-3"
          />
        </div>

        {/* Instructor */}
        <div className="space-y-1.5">
          <label className="text-sm text-slate-600">Instructor</label>
          <input
            value={form.instructor ?? ''}
            onChange={(e) => setForm({ ...form, instructor: e.target.value })}
            placeholder="Nombre del instructor"
            className="h-11 w-full rounded-lg border border-slate-300 px-3"
          />
        </div>

        {/* Capacidad */}
        <div className="space-y-1.5">
          <label className="text-sm text-slate-600">Capacidad Máxima</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={form.capacity ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              setForm({ ...form, capacity: v, max_students: v })
            }}
            placeholder="20"
            className="h-11 w-full rounded-lg border border-slate-300 px-3"
          />
        </div>

        {/* Color */}
        <div className="space-y-1.5">
          <label className="text-sm text-slate-600">Color Identificador</label>
          <select
            value={form.color ?? 'blue'}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
          >
            <option value="blue">Azul</option>
            <option value="red">Rojo</option>
            <option value="green">Verde</option>
            <option value="purple">Violeta</option>
            <option value="orange">Naranja</option>
            <option value="pink">Rosa</option>
          </select>
        </div>

        {/* DÍAS – Botones toggle */}
        <div className="space-y-1.5">
          <label className="text-sm text-slate-600">Días</label>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => {
              const active = (form.days ?? []).includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    active
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        {/* Hora inicio */}
        <div className="space-y-1.5">
          <label className="text-sm text-slate-600">Hora Inicio</label>
          <input
            type="time"
            value={form.start_time ?? ''}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-300 px-3"
          />
        </div>

        {/* Hora fin */}
        <div className="space-y-1.5">
          <label className="text-sm text-slate-600">Hora Fin</label>
          <input
            type="time"
            value={form.end_time ?? ''}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-300 px-3"
          />
        </div>

        {/* Descripción */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm text-slate-600">Descripción</label>
          <textarea
            rows={4}
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descripción de la clase"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="h-11 rounded-lg border border-slate-300 px-4 text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700 disabled:opacity-70"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
