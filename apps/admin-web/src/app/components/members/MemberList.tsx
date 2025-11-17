'use client'

import { Calendar, Mail, Phone, Pencil, Trash2 } from 'lucide-react'

type MemberRow = {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  access_code: string | null
  membership_type: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | null
  next_payment_due: string | null // YYYY-MM-DD
  status?: 'activo' | 'inactivo'
  // <- NUEVO: viene de la vista members_with_status
  class_names?: string[]
}

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
    <div className="space-y-4">
      {members.map((m) => {
        const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ').trim()

        // Si la vista trae 'status', úsalo; si no, derivá por fecha
        const today = new Date(new Date().toDateString())
        const derived =
          m.status ?? (m.next_payment_due && new Date(m.next_payment_due) >= today ? 'activo' : 'inactivo')

        const isActive = derived === 'activo'
        const statusLabel = isActive ? 'activo' : 'vencido'
        const statusClass = isActive
          ? 'bg-green-100 text-green-700 border-green-200'
          : 'bg-red-100 text-red-700 border-red-200'

        const membLabel =
          m.membership_type === 'monthly'
            ? 'Mensual'
            : m.membership_type === 'quarterly'
            ? 'Trimestral'
            : m.membership_type === 'semiannual'
            ? 'Semestral'
            : m.membership_type === 'annual'
            ? 'Anual'
            : '—'

        return (
          <div key={m.user_id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-semibold text-slate-900">{fullName || '—'}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  <span className="font-medium">Código:</span> {m.access_code || '—'}
                </p>

                {/* chips estado + membresía */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs ${statusClass}`}>{statusLabel}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
                    {membLabel}
                  </span>
                </div>

                {/* contacto + vencimiento */}
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <span className="truncate">{m.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-500" />
                    <span>{m.phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span>
                      <span className="text-slate-500">Vence:</span> {fmtDate(m.next_payment_due)}
                    </span>
                  </div>
                </div>

                {/* Clases */}
                {m.class_names && m.class_names.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.class_names.map((cn, i) => (
                      <span
                        key={`${m.user_id}-${i}`}
                        className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 border border-blue-200"
                      >
                        {cn}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-400">Sin clases asignadas</div>
                )}
              </div>

              {/* acciones */}
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => onEdit(m)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  aria-label="Editar"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(m.user_id)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  aria-label="Eliminar"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
