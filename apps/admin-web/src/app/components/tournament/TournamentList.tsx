'use client'

export default function TournamentList({ tournaments }: { tournaments: any[] }) {
  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="p-5 border-b font-semibold text-lg">Torneos creados</div>
      {tournaments.length ? (
        <ul className="divide-y">
          {tournaments.map((t) => (
            <li key={t.id} className="p-4 flex justify-between items-center">
              <div>
                <div className="font-medium text-slate-900">{t.name}</div>
                <div className="text-sm text-slate-500">{t.description}</div>
              </div>
              <div className="text-sm text-slate-600">
                {new Date(t.start_date).toLocaleDateString('es-AR')}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5 text-slate-500">No hay torneos aún</div>
      )}
    </section>
  )
}
