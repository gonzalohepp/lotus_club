'use client'
import { motion } from 'framer-motion'
import { DollarSign } from 'lucide-react'
import Image from 'next/image'
import { fmtARS, fmtDateShort } from '@/lib/format'
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
          <div key={i} className="h-20 w-full bg-carbon-100 animate-pulse rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-dashed border-carbon-200 p-12 text-center">
        <p className="text-carbon-500 font-medium italic">Sin pagos recientes registrados</p>
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
          className="group flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white dark:bg-carbon-800/50 dark:backdrop-blur-xl dark:border-carbon-700 shadow-lg shadow-carbon-200/50 dark:shadow-none hover:shadow-xl hover:scale-[1.01] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-kuro-500/10 flex items-center justify-center text-kuro-600 group-hover:scale-110 transition-transform overflow-hidden relative">
              {r.profiles?.avatar_url ? (
                <Image
                  src={r.profiles.avatar_url}
                  className="object-cover"
                  alt={r.profiles?.first_name || 'Miembro'}
                  fill
                />
              ) : (
                <DollarSign className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="font-black text-carbon-900 dark:text-white leading-tight">
                {r.profiles?.first_name || r.profiles?.last_name
                  ? `${r.profiles?.first_name ?? ''} ${r.profiles?.last_name ?? ''}`.trim()
                  : 'Miembro'}
              </div>
              <div className="text-xs font-bold text-carbon-400 uppercase tracking-widest mt-0.5">
                {/* Con toLocaleDateString() sin locale salía en formato del
                    navegador: "7/30/2026" en vez de "30 jul 2026". */}
                {fmtDateShort(r.paid_at)} • {r.method ?? 'Efectivo'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-carbon-900 dark:text-white tabular-nums">
              {fmtARS(r.amount)}
            </div>
            <div className="text-[10px] font-black text-kuro-500 uppercase tracking-tighter">Completado</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
