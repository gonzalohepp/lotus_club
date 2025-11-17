'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../../layouts/AdminLayout'
import { Plus, Swords, Braces } from 'lucide-react'
import TeamList from '../../components/tournament/TeamList'
import TeamModal from '../../components/tournament/TeamModal'
import BracketView from '../../components/tournament/BracketView'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Tournament = { id: string; name: string; description: string | null; start_date: string }
type Team = { id: string; name: string }
type Match = {
  id: string
  round: number
  team_a_id: string | null
  team_b_id: string | null
  winner_id: string | null
  match_date: string | null
  team_a?: Team | null
  team_b?: Team | null
  winner?: Team | null
}

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'teams'|'bracket'>('teams')

  const load = async () => {
    setLoading(true)

    const [{ data: t }, { data: ts }, { data: ms }] = await Promise.all([
      supabase.from('tournaments').select('id,name,description,start_date').eq('id', id).maybeSingle(),
      supabase.from('teams').select('id,name').eq('tournament_id', id).order('name'),
      supabase.from('matches')
        .select(`
          id, round, team_a_id, team_b_id, winner_id, match_date,
          team_a:teams!matches_team_a_id_fkey(id,name),
          team_b:teams!matches_team_b_id_fkey(id,name),
          winner:teams!matches_winner_id_fkey(id,name)
        `)
        .eq('tournament_id', id)
        .order('round', { ascending: true })
        .order('id', { ascending: true })
    ])

    setTournament(t as Tournament | null)
    setTeams((ts ?? []) as Team[])
    setMatches((ms ?? []) as Match[])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const rounds = useMemo(() => {
    const byRound: Record<number, Match[]> = {}
    matches.forEach(m => {
      byRound[m.round] = byRound[m.round] || []
      byRound[m.round].push(m)
    })
    return Object.entries(byRound)
      .sort(([a],[b]) => Number(a)-Number(b))
      .map(([r, list]) => ({ round: Number(r), matches: list }))
  }, [matches])

  const generateBracket = async () => {
    // limpia llaves previas si querés regenerar
    if (!confirm('Esto generará las llaves de la ronda 1 (se borrarán llaves anteriores). ¿Continuar?')) return
    await supabase.from('matches').delete().eq('tournament_id', id)

    // shuffle equipos
    const shuffled = [...teams].sort(() => Math.random() - 0.5)
    // si es impar, agregamos un BYE (team_b_id null)
    const inserts: any[] = []
    for (let i = 0; i < shuffled.length; i += 2) {
      const a = shuffled[i]
      const b = shuffled[i+1]
      inserts.push({
        tournament_id: id,
        round: 1,
        team_a_id: a?.id ?? null,
        team_b_id: b?.id ?? null,
        // si hay BYE, adelantamos ganador (team_a) automáticamente
        winner_id: b ? null : a?.id ?? null
      })
    }
    if (inserts.length) {
      await supabase.from('matches').insert(inserts)
    }
    await load()
    setTab('bracket')
  }

  const setWinner = async (m: Match, winnerTeamId: string) => {
    await supabase.from('matches').update({ winner_id: winnerTeamId }).eq('id', m.id)

    // si todas las partidas de esta ronda tienen winner, generamos siguiente ronda
    const sameRound = matches.filter(x => x.round === m.round).map(x => x.id)
    const nextState = await supabase
      .from('matches')
      .select('id, round, winner_id')
      .in('id', sameRound)

    const allHaveWinner = (nextState.data ?? []).every(x => x.winner_id)
    if (allHaveWinner) {
      // recogemos ganadores en orden de creación para parearlos
      const winners = (await supabase
        .from('matches')
        .select('winner_id')
        .eq('tournament_id', id)
        .eq('round', m.round)
        .order('id', { ascending: true })
      ).data?.map(w => w.winner_id).filter(Boolean) as string[]

      if (winners.length >= 1) {
        const inserts: any[] = []
        for (let i = 0; i < winners.length; i += 2) {
          const a = winners[i]
          const b = winners[i+1]
          inserts.push({
            tournament_id: id,
            round: m.round + 1,
            team_a_id: a ?? null,
            team_b_id: b ?? null,
            winner_id: b ? null : a ?? null
          })
        }
        if (inserts.length) await supabase.from('matches').insert(inserts)
      }
    }
    await load()
  }

  if (!tournament && !loading) {
    // torneo eliminado o id inválido
    router.push('/torneo')
    return null
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{tournament?.name ?? 'Torneo'}</h1>
          {tournament?.start_date && (
            <p className="text-slate-600">
              Inicio: {new Date(tournament.start_date).toLocaleDateString('es-AR')}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {tab === 'teams' && (
            <>
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" /> Agregar Equipo
              </button>
              <button
                onClick={generateBracket}
                disabled={!teams.length}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Generar llaves (ronda 1)"
              >
                <Swords className="h-5 w-5" /> Generar Llaves
              </button>
            </>
          )}
          <button
            onClick={() => setTab(tab === 'teams' ? 'bracket' : 'teams')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            <Braces className="h-5 w-5" />
            {tab === 'teams' ? 'Ver Llaves' : 'Ver Equipos'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      {tab === 'teams' ? (
        <TeamList
          loading={loading}
          teams={teams}
          tournamentId={id}
          onChanged={load}
        />
      ) : (
        <BracketView
          loading={loading}
          rounds={rounds}
          onPickWinner={setWinner}
        />
      )}

      <TeamModal
        open={open}
        onClose={() => setOpen(false)}
        tournamentId={id}
        onSaved={() => { setOpen(false); load() }}
      />
    </AdminLayout>
  )
}
