import { Pencil, Trash2, CalendarDays, DollarSign, User, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ClassRow } from './ClassForm'
import React from 'react'

/**
 * ClassCard — Una clase en la grilla de /classes.
 *
 * Sobre el color: cada clase tiene un color elegido por el administrador. Es un
 * color de DATO, no de marca, y por eso la paleta sigue siendo la original —si
 * "blue" pintara verde, la tarjeta no coincidiría con lo guardado en la base.
 *
 * Lo que cambió es CUÁNTO pesa ese color. La versión anterior lo usaba como un
 * halo permanente detrás de la tarjeta (`boxShadow: 0 12px 40px ${color}BB`):
 * doce tarjetas encendidas en rojo, cian y violeta contra el fondo hueso y el
 * verde Palm Leaf del resto de la app, que no comparte nada con esos tonos. El
 * color quedaba mandando en una pantalla donde la información es el texto.
 *
 * Ahora el color entra por donde identifica sin gritar: una banda al costado,
 * un punto junto al título y los chips de los íconos. La sombra pasa a ser
 * neutra —profundidad, no luz de neón— y el relieve queda para el hover.
 */

type Props =
  | { classItem: ClassRow; data?: never; canManage?: boolean; onEdit: () => void; onDelete: () => void }
  | { data: ClassRow; classItem?: never; canManage?: boolean; onEdit: () => void; onDelete: () => void }

const colorSchemes: Record<string, { bg: string, text: string, border: string, glow: string, icon: string, color: string }> = {
  // Token de marca: es el que usan las clases nuevas desde que se sacó el
  // selector de cromática. Los nombres de abajo quedan para las clases
  // que ya tenían un color elegido con el selector viejo.
  kuro: { bg: 'bg-kuro-50', text: 'text-kuro-700', border: 'border-kuro-200', glow: 'shadow-kuro-500/40', icon: 'text-kuro-500', color: '#899878' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', glow: 'shadow-blue-500/40', icon: 'text-blue-500', color: '#3b82f6' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', glow: 'shadow-red-500/40', icon: 'text-red-500', color: '#ef4444' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', glow: 'shadow-emerald-500/40', icon: 'text-emerald-500', color: '#10b981' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', glow: 'shadow-purple-500/40', icon: 'text-purple-500', color: '#8b5cf6' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', glow: 'shadow-orange-500/40', icon: 'text-orange-500', color: '#f97316' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', glow: 'shadow-pink-500/40', icon: 'text-pink-500', color: '#ec4899' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', glow: 'shadow-amber-500/40', icon: 'text-amber-500', color: '#f59e0b' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', glow: 'shadow-teal-500/40', icon: 'text-teal-500', color: '#14b8a6' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', glow: 'shadow-cyan-500/40', icon: 'text-cyan-500', color: '#06b6d4' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', glow: 'shadow-indigo-500/40', icon: 'text-indigo-500', color: '#6366f1' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', glow: 'shadow-rose-500/40', icon: 'text-rose-500', color: '#f43f5e' },
}

function fmtTime(t?: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${h}:${m}`
}

export default function ClassCard(props: Props) {
  const item: ClassRow = (('classItem' in props ? props.classItem : props.data) as ClassRow)!
  const scheme = colorSchemes[item?.color ?? 'kuro'] ?? colorSchemes.kuro
  const canManage = props.canManage ?? true

  const days = item?.days && item.days.length ? item.days.join(' · ') : 'Sin días'
  const timeStr = item?.start_time ? `${fmtTime(item.start_time)}${item.end_time ? ` – ${fmtTime(item.end_time)}` : ''}` : 'Horario a confirmar'

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group relative overflow-hidden rounded-3xl border border-carbon-200 bg-white p-7 pl-8 shadow-sm transition-shadow hover:shadow-lg hover:shadow-carbon-900/[0.07] dark:border-carbon-700 dark:bg-carbon-800 dark:hover:shadow-black/30"
    >
      {/* Identidad de la clase: una banda al filo izquierdo. Ocupa 4px en vez
          de envolver la tarjeta entera, y se lee igual de rápido. */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: scheme.color }}
      />

      {/* Header Area */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {/* El título envuelve en vez de recortarse: "BJJ Gi — Noche" y
              "BJJ Gi — Mañana" comparten el arranque, así que cortar por el
              final las dejaría idénticas en pantalla. */}
          <div className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: scheme.color }}
            />
            <h3 className="text-2xl font-black leading-tight tracking-tight text-carbon-900 dark:text-white">
              {item?.name}
            </h3>
          </div>
          <p className="mt-2 pl-4 text-[10px] font-black uppercase tracking-widest text-carbon-400">
            {item?.category === 'acondicionamiento-fisico' ? 'Físico' : 'Artes Marciales'}
          </p>
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-all translate-y-2 group-hover:translate-y-0 group-hover:opacity-100">
            <button
              onClick={props.onEdit}
              aria-label="Editar clase"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-carbon-200 bg-carbon-50 text-carbon-500 transition-all hover:border-kuro-600 hover:bg-kuro-600 hover:text-white dark:border-carbon-600 dark:bg-carbon-700 dark:text-carbon-300"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={props.onDelete}
              aria-label="Eliminar clase"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-carbon-200 bg-carbon-50 text-carbon-500 transition-all hover:border-alert-600 hover:bg-alert-600 hover:text-white dark:border-carbon-600 dark:bg-carbon-700 dark:text-carbon-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Info Grid */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-carbon-100 bg-carbon-50 p-4 dark:border-carbon-700 dark:bg-carbon-900/50">
          <div className="mb-1 flex items-center gap-2 text-carbon-400">
            <DollarSign className="h-3 w-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">Base (P)</span>
          </div>
          <p className="text-lg font-black leading-none text-carbon-900 dark:text-white">
            ${(Number(item?.price_principal) || 0).toLocaleString('es-AR')}
          </p>
        </div>

        <div className="rounded-2xl border border-carbon-100 bg-carbon-50 p-4 dark:border-carbon-700 dark:bg-carbon-900/50">
          <div className="mb-1 flex items-center gap-2 text-carbon-400">
            <DollarSign className="h-3 w-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">Extra (A)</span>
          </div>
          <p className="text-lg font-black leading-none text-carbon-900 dark:text-white">
            {item?.price_additional ? `$${Number(item.price_additional).toLocaleString('es-AR')}` : '—'}
          </p>
        </div>
      </div>

      {/* Details List */}
      <div className="mb-6 space-y-3 px-1">
        {([
          { icon: User, label: 'Instructor', value: item?.instructor || 'Coaches Dojo' },
          { icon: CalendarDays, label: 'Días', value: days },
          { icon: Clock, label: 'Horario', value: timeStr },
        ] as const).map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            {/* El chip lleva el color de la clase en 12% de opacidad: identifica
                sin competir con el texto, y funciona igual en oscuro. */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${scheme.color}1F`, color: scheme.color }}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-[10px] font-black uppercase leading-none tracking-widest text-carbon-400">
                {label}
              </p>
              <p className="truncate text-sm font-bold text-carbon-700 dark:text-carbon-200">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Description */}
      {item?.description && (
        <div className="border-t border-carbon-100 pt-4 dark:border-carbon-700">
          <p className="line-clamp-2 text-sm font-medium italic leading-relaxed text-carbon-500 dark:text-carbon-400">
            &ldquo;{item.description}&rdquo;
          </p>
        </div>
      )}
    </motion.div>
  )
}
