'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TeamModal({
  open,
  onClose,
  tournamentId,
  onSaved
}: {
  open: boolean
  onClose: () => void
  tournamentId: string
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [players, setPlayers] = useState([{ name: '', email: '' }, { name: '', email: '' }]) // 2 por defecto
  const [saving, setSaving] = useState(false)

  const addPlayer = () => {
    if (players.length >= 3) return
    setPlayers([...players, { name: '', email: '' }])
  }

  const removePlayer = (idx: number) => {
    if (players.length <= 2) return
    setPlayers(players.filter((_, i) => i !== idx))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return alert('Nombre del equipo requerido')
    if (players.some(p => !p.name.trim())) return alert('Todos los jugadores deben tener nombre')
    if (players.length < 2 || players.length > 3) return alert('El equipo debe tener 2 o 3 jugadores')

    setSaving(true)
    const { data: team, error } = await supabase
      .from('teams')
      .insert({ tournament_id: tournamentId, name })
      .select('id')
      .maybeSingle()

    if (error || !team) {
      setSaving(false)
      return alert('Error creando equipo')
    }

    await supabase.from('team_members').insert(
      players.map(p => ({ team_id: team.id, member_name: p.name, member_email: p.email || null }))
    )

    setSaving(false)
    onSaved()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold">Nuevo Equipo</h2>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del equipo</label>
            <input
              className="w-full rounded border p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Los Guerreros"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Jugadores (2–3)</span>
              <button
                type="button"
                onClick={addPlayer}
                disabled={players.length >= 3}
                className="rounded border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                + Agregar
              </button>
            </div>

            {players.map((p, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <input
                  className="col-span-3 rounded border p-2"
                  placeholder={`Jugador ${idx+1} (nombre)`}
                  value={p.name}
                  onChange={(e) => {
                    const arr = [...players]; arr[idx].name = e.target.value; setPlayers(arr)
                  }}
                  required
                />
                <input
                  className="col-span-2 rounded border p-2"
                  placeholder="email (opcional)"
                  value={p.email}
                  onChange={(e) => {
                    const arr = [...players]; arr[idx].email = e.target.value; setPlayers(arr)
                  }}
                />
                {players.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removePlayer(idx)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2">Cancelar</button>
            <button disabled={saving} className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
