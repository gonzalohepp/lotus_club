import { ReactNode } from 'react'
import { motion } from 'framer-motion'

export default function StatsCard({
  title,
  value,
  icon,
  color = 'blue',
  loading = false,
}: {
  title: string
  value: ReactNode
  icon: ReactNode
  color?: 'blue' | 'green' | 'red' | 'purple'
  loading?: boolean
}) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/5 text-blue-500 border-blue-500/20',
    green: 'from-green-500/20 to-green-600/5 text-green-500 border-green-500/20',
    red: 'from-red-500/20 to-red-600/5 text-red-500 border-red-500/20',
    purple: 'from-purple-500/20 to-purple-600/5 text-purple-500 border-purple-500/20',
  }

  const hue = colors[color] || colors.blue

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-sm group transition-all"
    >
      {/* Background Glow */}
      <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full blur-[60px] opacity-20 bg-gradient-to-br ${hue}`} />

      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">{title}</p>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {loading ? (
              <div className="h-9 w-24 rounded-lg bg-slate-200 animate-pulse" />
            ) : (
              value
            )}
          </div>
        </div>
        <div className={`rounded-2xl p-3 bg-gradient-to-br border shadow-lg ${hue} transition-transform group-hover:rotate-12`}>
          {icon}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: loading ? '30%' : '100%' }}
            className={`h-full rounded-full bg-gradient-to-r ${hue}`}
          />
        </div>
      </div>
    </motion.div>
  )
}
