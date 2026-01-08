'use client'
import { motion } from 'framer-motion'
import { Calendar, AlertTriangle } from 'lucide-react'
type Expiring = { user_id: string; first_name: string | null; last_name: string | null; end_date: string }
export default function ExpiringMembers({ rows, loading }: { rows: Expiring[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 w-full bg-slate-100 animate-pulse rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!rows?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/30">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Todo al día</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map((m, i) => (
        <motion.div
          key={m.user_id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-red-100 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">
                {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.user_id.slice(0, 8)}
              </div>
              <div className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-tighter">
                <Calendar className="w-3 h-3" />
                Vence el {new Date(m.end_date).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg uppercase tracking-widest">Urgente</div>
        </motion.div>
      ))}
    </div>
  )
}
