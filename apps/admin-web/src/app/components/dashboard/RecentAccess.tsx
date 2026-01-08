'use client'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

type AccessRow = {
  scanned_at: string
  result: string
  reason: string | null
  profiles?: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null
}

const norm = (v: string | null | undefined) => (v ?? '').toLowerCase().trim()

const isAllowed = (r: AccessRow) => {
  const v = norm(r.result)
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
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 w-full bg-slate-100 animate-pulse rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center">
        <p className="text-slate-500 font-medium italic">Sin registros de acceso hoy</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const ok = isAllowed(r)
        const name =
          r.profiles?.first_name || r.profiles?.last_name
            ? `${r.profiles?.first_name ?? ''} ${r.profiles?.last_name ?? ''}`.trim()
            : 'Miembro'

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white shadow-lg shadow-slate-200/50"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${ok ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                }`}>
                {r.profiles?.avatar_url ? (
                  <img src={r.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  ok ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="font-bold text-slate-900">{name}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {new Date(r.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  <span className="opacity-30">•</span>
                  {ok ? 'Acceso Autorizado' : `DENEGADO: ${r.reason ?? 'TOKEN INVÁLIDO'}`}
                </div>
              </div>
            </div>

            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
              {ok ? 'Valido' : 'No valido'}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
