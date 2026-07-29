'use client'
import { motion } from 'framer-motion'
import { Calendar, AlertTriangle, MessageCircle } from 'lucide-react'
import { useTenant } from '@/lib/tenant/context'
type Expiring = { user_id: string; first_name: string | null; last_name: string | null; end_date: string; phone?: string | null }
export default function ExpiringMembers({ rows, loading }: { rows: Expiring[]; loading?: boolean }) {
  // Nombre con el que se firma hacia el alumno: el display_name configurado en
  // /superadmin, o el de la organización.
  const { branding, org } = useTenant()
  const marca = branding.display_name || org?.name || 'tu dojo'

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

  const handleWhatsApp = (m: Expiring) => {
    const name = m.first_name || 'Alumno'
    // La firma sale de la marca activa: mandarle a un alumno de Lotus un
    // mensaje que dice "Beleza Dojo" es peor que no mandarlo.
    const msg = `Hola ${name}! Te escribimos de ${marca} para recordarte que tu membresía vence el ${new Date(m.end_date).toLocaleDateString()}. ¡Te esperamos! 🥋`
    const phone = m.phone?.replace(/\D/g, '') || ''
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
      {rows.map((m, i) => (
        <motion.div
          key={m.user_id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/50 dark:backdrop-blur-xl border border-red-100 dark:border-red-900/30 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.user_id.slice(0, 8)}
              </div>
              <div className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-tighter">
                <Calendar className="w-3 h-3" />
                Vence el {new Date(m.end_date).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {m.phone && (
              <button
                onClick={() => handleWhatsApp(m)}
                className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                title="Mensaje de WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            )}
            <div className="text-[10px] font-black text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg uppercase tracking-widest">Urgente</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
