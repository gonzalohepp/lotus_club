'use client'

import { Calendar, Mail, Phone, Pencil, Trash2, User as UserIcon, Shield, Hash, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { MemberRow } from '@/types/member'

export default function MemberList({
  members,
  loading,
  onEdit,
  onDelete,
}: {
  members: MemberRow[]
  loading: boolean
  onEdit: (m: MemberRow) => void
  onDelete: (id: string) => void
}) {
  const fmtDate = (d?: string | null) =>
    d
      ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      : '—'

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border bg-white" />
        ))}
      </div>
    )
  }

  if (!members.length) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
        Sin resultados
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
      {members.map((m, idx) => {
        const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ').trim()
        const today = new Date(new Date().toDateString())
        const derived = m.status ?? (m.next_payment_due && new Date(m.next_payment_due) >= today ? 'activo' : 'inactivo')
        const isActive = derived === 'activo'

        return (
          <motion.div
            key={m.user_id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-300"
          >
            {/* Status Gradient Strip */}
            <div className={`h-1.5 w-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />

            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shadow-inner">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={fullName} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-white flex items-center justify-center shadow-sm ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-black text-slate-900 tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
                    {fullName || 'Sin Nombre'}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-400 tracking-widest uppercase">
                    <Hash className="w-3 h-3" />
                    {m.access_code || '---'}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Status & Membership */}
                <div className="flex flex-wrap gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {isActive ? 'Activo' : 'Vencido'}
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-100 text-[10px] font-black uppercase tracking-widest">
                    <Shield className="w-3 h-3" />
                    {m.membership_type || 'Manual'}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="truncate">{m.email || '---'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span>{m.phone || '---'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${isActive ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-0.5">Vencimiento</span>
                      <span className={isActive ? 'text-slate-900' : 'text-red-600 font-bold'}>{fmtDate(m.next_payment_due)}</span>
                    </div>
                  </div>
                </div>

                {/* Classes Section */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clases Inscritas</span>
                  </div>
                  {m.class_names && m.class_names.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {m.class_names.map((cn, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100">
                          {cn}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sin clases asignadas</span>
                  )}
                </div>
              </div>

              {/* Action Buttons - Sticky at bottom */}
              <div className="mt-8 flex gap-2">
                <button
                  onClick={() => onEdit(m)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-blue-600 transition-colors shadow-lg shadow-slate-900/10"
                >
                  <Pencil className="w-3 h-3" />
                  EDITAR
                </button>
                <button
                  onClick={() => onDelete(m.user_id)}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
