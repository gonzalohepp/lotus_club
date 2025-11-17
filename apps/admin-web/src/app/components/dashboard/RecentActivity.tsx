'use client'
type Row = {
  amount: number
  method: string | null
  paid_at: string
  profiles?: { first_name: string | null; last_name: string | null } | null
}
export default function RecentActivity({ rows, loading }: { rows: Row[]; loading?: boolean }) {
  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="p-5 border-b">
        <h2 className="text-lg font-semibold">Actividad Reciente</h2>
      </div>
      <ul className="divide-y">
        {loading ? (
          <li className="p-5 text-slate-400 animate-pulse">Cargando…</li>
        ) : rows.length ? (
          rows.map((r, i) => (
            <li key={i} className="p-5 flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {r.profiles?.first_name || r.profiles?.last_name
                    ? `${r.profiles?.first_name ?? ''} ${r.profiles?.last_name ?? ''}`.trim()
                    : 'Miembro'}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(r.paid_at).toLocaleDateString()} — {r.method ?? '—'}
                </div>
              </div>
              <div className="text-green-700 font-semibold">
                ${Number(r.amount).toLocaleString()}
              </div>
            </li>
          ))
        ) : (
          <li className="p-5 text-slate-500">Sin pagos recientes</li>
        )}
      </ul>
    </section>
  )
}
