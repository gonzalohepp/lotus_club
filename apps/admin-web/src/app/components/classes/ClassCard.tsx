import { Pencil, Trash2, CalendarDays, DollarSign, Users, User, Clock, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ClassRow } from './ClassForm'
import React from 'react'

type Props =
  | { classItem: ClassRow; data?: never; onEdit: () => void; onDelete: () => void }
  | { data: ClassRow; classItem?: never; onEdit: () => void; onDelete: () => void }

const colorSchemes: Record<string, { bg: string, text: string, border: string, glow: string, icon: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', glow: 'shadow-blue-500/20', icon: 'text-blue-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', glow: 'shadow-red-500/20', icon: 'text-red-500' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', glow: 'shadow-emerald-500/20', icon: 'text-emerald-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', glow: 'shadow-purple-500/20', icon: 'text-purple-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', glow: 'shadow-orange-500/20', icon: 'text-orange-500' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', glow: 'shadow-pink-500/20', icon: 'text-pink-500' },
}

function fmtTime(t?: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${h}:${m}`
}

export default function ClassCard(props: Props) {
  const item: ClassRow = (('classItem' in props ? props.classItem : props.data) as ClassRow)!
  const scheme = colorSchemes[item?.color ?? 'blue'] ?? colorSchemes.blue

  const days = item?.days && item.days.length ? item.days.join(' · ') : 'Sin días'
  const timeStr = item?.start_time ? `${fmtTime(item.start_time)}${item.end_time ? ` – ${fmtTime(item.end_time)}` : ''}` : 'Horario a confirmar'

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`group relative overflow-hidden rounded-[32px] border bg-white p-6 shadow-sm transition-all hover:shadow-2xl ${scheme.glow} ${scheme.border} border-opacity-50`}
    >
      {/* Decorative Glow */}
      <div className={`absolute -right-16 -top-16 h-32 w-32 rounded-full transition-opacity opacity-0 group-hover:opacity-10 blur-3xl ${scheme.bg.replace('50', '500')}`} />

      {/* Header Area */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-1">
          <div className={`inline-flex items-center rounded-lg ${scheme.bg} px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${scheme.text} ring-1 ring-inset ${scheme.border}`}>
            Inscripciones Abiertas
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none pt-2">
            {item?.name}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
          <button
            onClick={props.onEdit}
            className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={props.onDelete}
            className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2 mb-1 text-slate-400">
            <DollarSign className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">Inversión</span>
          </div>
          <p className="text-lg font-black text-slate-900 leading-none">
            ${(Number(item?.price) || 0).toLocaleString()}
            <span className="text-[10px] font-bold text-slate-400 ml-1">/MES</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2 mb-1 text-slate-400">
            <Users className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">Cupos</span>
          </div>
          <p className="text-lg font-black text-slate-900 leading-none">
            {item?.capacity ?? item?.max_students ?? '—'}
          </p>
        </div>
      </div>

      {/* Details List */}
      <div className="space-y-3 px-1 mb-6">
        <div className="flex items-center gap-3 text-slate-600">
          <div className={`w-8 h-8 rounded-lg ${scheme.bg} flex items-center justify-center ${scheme.icon}`}>
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Instructor</p>
            <p className="text-sm font-bold text-slate-700">{item?.instructor || 'Coaches Dojo'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-600">
          <div className={`w-8 h-8 rounded-lg ${scheme.bg} flex items-center justify-center ${scheme.icon}`}>
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Días</p>
            <p className="text-sm font-bold text-slate-700">{days}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-600">
          <div className={`w-8 h-8 rounded-lg ${scheme.bg} flex items-center justify-center ${scheme.icon}`}>
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Horario</p>
            <p className="text-sm font-bold text-slate-700">{timeStr}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      {item?.description && (
        <div className="pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-2 italic">
            "{item.description}"
          </p>
        </div>
      )}

      {/* Detail Anchor */}
      <div className="mt-8 flex items-center justify-between">
        <div className="flex -space-x-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200" />
          ))}
          <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
            +8
          </div>
        </div>
        <button className={`flex items-center gap-1 text-xs font-black uppercase tracking-widest ${scheme.text} hover:translate-x-1 transition-transform`}>
          Detalles <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  )
}
