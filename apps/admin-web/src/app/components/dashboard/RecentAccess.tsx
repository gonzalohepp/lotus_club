'use client'

type AccessRow = {
  scanned_at: string
  result: string            // puede venir "autorizado"/"denegado" o "authorized"/"denied"/"success"
  reason: string | null
  profiles?: { first_name: string | null; last_name: string | null } | null
}

const norm = (v: string | null | undefined) => (v ?? '').toLowerCase().trim()

const isAllowed = (r: AccessRow) => {
  const v = norm(r.result)
  // aceptamos varias variantes por si cambia el origen
  return (
    v === 'autorizado' ||
    v === 'authorized' ||
    v === 'success' ||
    v === 'allow' ||
    v === 'allowed' ||
    v === 'ok' ||
    v === 'permitido'
  )
}

export default function RecentAccess({ rows, loading }: { rows: AccessRow[]; loading?: boolean }) {
  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="p-5 border-b">
        <h2 className="text-lg font-semibold">Últimos Accesos</h2>
      </div>

      <ul className="divide-y">
        {loading ? (
          <li className="p-5 text-slate-400 animate-pulse">Cargando…</li>
        ) : rows.length ? (
          rows.map((r, i) => {
            const ok = isAllowed(r)
            const name =
              r.profiles?.first_name || r.profiles?.last_name
                ? `${r.profiles?.first_name ?? ''} ${r.profiles?.last_name ?? ''}`.trim()
                : 'Miembro'

            return (
              <li key={i} className="p-5 flex items-center justify-between">
                <div>
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(r.scanned_at).toLocaleString()} — {ok ? 'Acceso autorizado' : `Denegado (${r.reason ?? '—'})`}
                  </div>
                </div>

                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {ok ? 'autorizado' : 'denegado'}
                </span>
              </li>
            )
          })
        ) : (
          <li className="p-5 text-slate-500">Sin registros recientes</li>
        )}
      </ul>
    </section>
  )
}
