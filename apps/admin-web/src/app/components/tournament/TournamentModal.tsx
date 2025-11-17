'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TournamentModal({ open, onClose, onCreated }: any) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await supabase.from('tournaments').insert({ name, description, start_date: startDate })
    onCreated()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Nuevo Torneo</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Nombre del torneo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border p-2"
            required
          />
          <textarea
            placeholder="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border p-2"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border p-2"
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-200">Cancelar</button>
            <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
