'use client'

import { Trophy, ArrowRight } from 'lucide-react'

type Team = { id: string; name: string }
type Match = {
  id: string
  round: number
  team_a?: Team | null
  team_b?: Team | null
  team_a_id?: string | null
  team_b_id?: string | null
  winner?: Team | null
  winner_id?: string | null
}
type Round = { round: number; matches: Match[] }

export default function BracketView({
  loading,
  rounds,
  onPickWinner
}: {
  loading?: boolean
  rounds: Round[]
  onPickWinner: (m: Match, winnerId: string) => Promise<void>
}) {
  if (loading) return <div className="rounded-2xl border bg-white p-5 shadow-sm text-slate-400">Cargando…</div>

  if (!rounds.length) {
    return (
      <section className="rounded-2xl border bg-white shadow-sm p-5 text-slate-500">
        No hay llaves generadas todavía
      </section>
    )
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm p-5 overflow-x-auto">
      <div className="min-w-[800px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {rounds.map(r => (
          <div key={r.round}>
            <h3 className="mb-3 text-sm font-semibold text-slate-600">Ronda {r.round}</h3>
            <div className="space-y-4">
              {r.matches.map(m => {
                const aName = m.team_a?.name ?? 'BYE'
                const bName = m.team_b?.name ?? (m.team_b_id ? 'Equipo' : 'BYE')
                const decided = Boolean(m.winner_id)
                return (
                  <div key={m.id} className="rounded-xl border bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{aName}</div>
                      {m.team_a?.id && !decided && (
                        <button
                          className="text-xs rounded bg-emerald-600 px-2 py-1 text-white"
                          onClick={() => onPickWinner(m as any, m.team_a!.id)}
                        >
                          Ganador
                        </button>
                      )}
                    </div>
                    <div className="my-2 flex items-center justify-center text-slate-400">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{bName}</div>
                      {m.team_b?.id && !decided && (
                        <button
                          className="text-xs rounded bg-emerald-600 px-2 py-1 text-white"
                          onClick={() => onPickWinner(m as any, m.team_b!.id)}
                        >
                          Ganador
                        </button>
                      )}
                    </div>

                    {decided && (
                      <div className="mt-3 flex items-center gap-2 text-emerald-700 text-sm">
                        <Trophy className="h-4 w-4" />
                        {m.winner?.name ?? 'Ganador'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
