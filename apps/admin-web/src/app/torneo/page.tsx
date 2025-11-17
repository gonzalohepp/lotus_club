'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../layouts/AdminLayout'
import { Plus, CalendarDays, UsersRound } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Tournament = {
  id: string
  name: string
  team_size: number // 2 o 3
  start_date: string | null
  created_at: string
}

export default function TorneoListPage() {
  const [rows, setRows] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  // modal crear
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [teamSize, setTeamSize] = useState<2 | 3>(2)
  const [startDate, setStartDate] = useState<string>('') // yyyy-mm-dd

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tournaments')
      .select('id,name,team_size,start_date,created_at')
      .order('created_at', { ascending: false })
    if (!error) setRows((data ?? []) as Tournament[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const canSave = useMemo(() => name.trim().length >= 3, [name])

  const onSave = async () => {
    if (!canSave) return
    const payload = {
      name: name.trim(),
      team_size: Number(teamSize),
      start_date: startDate || null,
    }
    const { error } = await supabase.from('tournaments').insert(payload)
    if (error) {
      alert('Error creando torneo: ' + error.message)
      return
    }
    // reset + refresh
    setOpen(false)
    setName('')
    setTeamSize(2)
    setStartDate('')
    await load()
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Torneos</h1>
          <p className="text-slate-600">Crea y administra llaves de 2 o 3 competidores por equipo</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Nuevo Torneo
        </button>
      </div>

      {/* Lista */}
      <div className="rounded-xl border bg-white">
        <table className="w-full table-auto">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Torneo</th>
              <th className="px-4 py-3">Equipos</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-slate-400" colSpan={4}>
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  No hay torneos. Creá el primero con “Nuevo Torneo”.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500">
                      Creado: {new Date(t.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700">
                      <UsersRound className="h-3.5 w-3.5" />
                      {t.team_size} por equipo
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                      <CalendarDays className="h-4 w-4 text-slate-500" />
                      {t.start_date
                        ? new Date(
                            t.start_date.includes('T') ? t.start_date : `${t.start_date}T00:00:00`
                          ).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/torneo/${t.id}`}
                      className="text-blue-600 hover:underline"
                      title="Ver detalle"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          {/* card */}
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Nuevo Torneo</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Copa Beleza Dojo"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Tamaño de equipo</label>
                  <select
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value) === 3 ? 3 : 2)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value={2}>2 (duplas)</option>
                    <option value={3}>3 (tríos)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">Fecha de inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                disabled={!canSave}
                onClick={onSave}
                className={`rounded-lg px-4 py-2 text-white shadow ${
                  canSave ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300'
                }`}
                title={canSave ? 'Crear torneo' : 'Ingresá un nombre (mín. 3)'}
              >
                Crear torneo
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
