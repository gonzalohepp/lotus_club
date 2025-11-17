'use client'
type Expiring = { user_id: string; first_name: string | null; last_name: string | null; end_date: string }
export default function ExpiringMembers({ rows, loading }: { rows: Expiring[]; loading?: boolean }) {
  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="p-5 border-b">
        <h2 className="text-lg font-semibold">Próximos a Vencer (7 días)</h2>
      </div>
      <ul className="divide-y">
        {loading ? (
          <li className="p-5 text-slate-400 animate-pulse">Cargando…</li>
        ) : rows?.length ? (
          rows.map((m) => (
            <li key={m.user_id} className="p-5 flex items-center justify-between">
              <div className="font-medium">
                {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.user_id.slice(0, 8)}
              </div>
              <div className="text-sm text-slate-600">
                {new Date(m.end_date).toLocaleDateString()}
              </div>
            </li>
          ))
        ) : (
          <li className="p-5 text-slate-500">No hay membresías próximas a vencer</li>
        )}
      </ul>
    </section>
  )
}
