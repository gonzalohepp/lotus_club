'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Trash2 } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Team = { id: string; name: string }
type Member = { id: number; member_name: string; member_email: string | null }

export default function TeamList({
  loading,
  teams,
  tournamentId,
  onChanged
}: {
  loading?: boolean
  teams: Team[]
  tournamentId: string
  onChanged: () => void
}) {
  const [membersByTeam, setMembersByTeam] = useState<Record<string, Member[]>>({})

  useEffect(() => {
    const loadMembers = async () => {
      if (!teams.length) { setMembersByTeam({}); return }
      const { data } = await supabase
        .from('team_members')
        .select('id,team_id,member_name,member_email')
        .in('team_id', teams.map(t => t.id))
      const map: Record<string, Member[]> = {}
      ;(data ?? []).forEach(row => {
        map[row.team_id] = map[row.team_id] || []
        map[row.team_id].push({
          id: row.id,
          member_name: row.member_name,
          member_email: row.member_email
        } as Member)
      })
      setMembersByTeam(map)
    }
    loadMembers()
  }, [teams])

  const removeTeam = async (teamId: string) => {
    if (!confirm('¿Eliminar equipo? Se borrarán sus jugadores y sus partidas.')) return
    await supabase.from('matches').delete().eq('team_a_id', teamId)
    await supabase.from('matches').delete().eq('team_b_id', teamId)
    await supabase.from('team_members').delete().eq('team_id', teamId)
    await supabase.from('teams').delete().eq('id', teamId)
    onChanged()
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="p-5 border-b">
        <h2 className="text-lg font-semibold">Equipos</h2>
      </div>

      {loading ? (
        <div className="p-5 text-slate-400">Cargando…</div>
      ) : teams.length ? (
        <ul className="divide-y">
          {teams.map(t => (
            <li key={t.id} className="p-5 flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-slate-900">{t.name}</div>
                <ul className="mt-1 text-sm text-slate-700 list-disc pl-4">
                  {(membersByTeam[t.id] ?? []).map(m => (
                    <li key={m.id}>
                      {m.member_name}
                      {m.member_email ? <span className="text-slate-500"> — {m.member_email}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => removeTeam(t.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-red-700 hover:bg-red-50"
                title="Eliminar equipo"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5 text-slate-500">Aún no hay equipos</div>
      )}
    </section>
  )
}
