'use client'

import { Pencil, Trash2, CalendarDays, DollarSign, Users } from 'lucide-react'
import type { ClassRow } from './ClassForm'
import React from 'react'

type Props =
  | { classItem: ClassRow; data?: never; onEdit: () => void; onDelete: () => void }
  | { data: ClassRow; classItem?: never; onEdit: () => void; onDelete: () => void }

const colorBar: Record<string, string> = {
  blue: 'border-l-4 border-l-blue-500',
  red: 'border-l-4 border-l-red-500',
  green: 'border-l-4 border-l-green-500',
  purple: 'border-l-4 border-l-purple-500',
  orange: 'border-l-4 border-l-orange-500',
  pink: 'border-l-4 border-l-pink-500',
}

function fmtTime(t?: string | null) {
  if (!t) return ''
  // Muestra HH:mm
  const [h, m] = t.split(':')
  return `${h}:${m}`
}

export default function ClassCard(props: Props) {
  // Soporta ambos nombres de prop (classItem | data)
  const item: ClassRow = (('classItem' in props ? props.classItem : props.data) as ClassRow)!

  const days = item?.days && item.days.length ? item.days.join(', ') : '—'
  const timeStr =
    item?.start_time || item?.end_time
      ? ` – ${fmtTime(item?.start_time)}${item?.end_time ? ` a ${fmtTime(item.end_time)}` : ''}`
      : ''

  const colorCls = colorBar[item?.color ?? 'blue'] ?? 'border-l-4 border-l-slate-300'

  return (
    <div className={`rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${colorCls}`}>
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{item?.name ?? 'Clase'}</h3>
            {item?.instructor && (
              <p className="text-sm text-slate-600">Instructor: {item.instructor}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={props.onEdit}
              className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={props.onDelete}
              className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-red-50 hover:text-red-600"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <DollarSign className="h-4 w-4" />
            <span>
              {typeof item?.price === 'number'
                ? `$${item.price.toLocaleString()}`
                : item?.price ?? '—'}/mes
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <Users className="h-4 w-4" />
            <span>Capacidad: {item?.capacity ?? item?.max_students ?? '—'}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <CalendarDays className="h-4 w-4" />
            <span>
              {days}
              {timeStr}
            </span>
          </div>

          {item?.description && (
            <p className="pt-1 text-slate-600">{item.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
