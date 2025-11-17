'use client'

import { X } from 'lucide-react'

type Props = {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function Modal({ title, open, onClose, children, footer }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center overflow-auto p-6">
        <div className="mt-10 w-full max-w-5xl rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-6 py-5">{children}</div>

          {footer && <div className="flex justify-end gap-3 border-t px-6 py-4">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
