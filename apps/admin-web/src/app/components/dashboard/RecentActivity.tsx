'use client'
import { motion } from 'framer-motion'
import { DollarSign } from 'lucide-react'
type Row = {
  amount: number
  method: string | null
  paid_at: string
  profiles?: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null
}
export default function RecentActivity({ rows, loading }: { rows: Row[]; loading?: boolean }) {
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
        <p className="text-slate-500 font-medium italic">Sin pagos recientes registrados</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="group flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white shadow-lg shadow-slate-200/50 hover:shadow-xl hover:scale-[1.01] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform overflow-hidden">
              {r.profiles?.avatar_url ? (
                <img src={r.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <DollarSign className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="font-black text-slate-900 leading-tight">
                {r.profiles?.first_name || r.profiles?.last_name
                  ? `${r.profiles?.first_name ?? ''} ${r.profiles?.last_name ?? ''}`.trim()
                  : 'Miembro'}
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {new Date(r.paid_at).toLocaleDateString()} • {r.method ?? 'Efectivo'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-slate-900 tabular-nums">
              ${Number(r.amount).toLocaleString()}
            </div>
            <div className="text-[10px] font-black text-green-500 uppercase tracking-tighter">Completado</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
