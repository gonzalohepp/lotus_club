'use client'

import { X } from 'lucide-react'
import MemberForm from './MemberForm'

type Row = {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  emergency_phone: string | null
  notes: string | null
  access_code: string | null
  membership_type: 'monthly'|'quarterly'|'semiannual'|'annual'|null
  end_date: string | null
  class_ids?: number[]
}

export default function MemberModal({
  open, onClose, member, onSubmit,
}: {
  open: boolean
  onClose: () => void
  member: Row | null
  onSubmit: (payload: any) => Promise<void>
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 md:p-8">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-semibold">{member ? 'Editar Miembro' : 'Nuevo Miembro'}</h2>
          <button onClick={onClose} className="rounded p-2 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto px-6 py-5">
          <MemberForm
            member={member}
            onCancel={onClose}
            onSubmit={async (data) => { await onSubmit(data); onClose() }}
          />
        </div>
      </div>
    </div>
  )
}
