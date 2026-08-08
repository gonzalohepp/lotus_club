import { ReactNode } from 'react'

/**
 * Tile de KPI del dashboard, según la maqueta del manual de Kuro: bloques con
 * fondo lleno (Palm Leaf / Beige / Onyx), no tarjetas blancas con una rayita de
 * color. El tono comunica el rol del dato, no decora:
 *
 *   hero    Onyx      el número que manda (la plata del mes)
 *   brand   Palm Leaf lo que está bien
 *   neutral Beige     conteos sin carga positiva ni negativa
 *   alert   rojo      lo que hay que ir a resolver
 */
export type StatTone = 'hero' | 'brand' | 'neutral' | 'alert'

const TONES: Record<StatTone, { card: string; label: string; value: string; icon: string; hint: string; meter: string }> = {
  hero: {
    card: 'bg-[#121113] border-[#121113]',
    label: 'text-[#A7ACA2]',
    value: 'text-[#F7F7F2]',
    icon: 'bg-white/10 text-[#899878]',
    hint: 'text-[#A7ACA2]',
    meter: 'bg-[#899878]',
  },
  brand: {
    card: 'bg-[#899878] border-[#899878]',
    label: 'text-[#1B2016]/75',
    value: 'text-[#121113]',
    icon: 'bg-[#121113]/12 text-[#121113]',
    hint: 'text-[#1B2016]/75',
    meter: 'bg-[#121113]',
  },
  neutral: {
    card: 'bg-[#E4E6C3] border-[#E4E6C3]',
    label: 'text-[#3A3F2E]/75',
    value: 'text-[#222725]',
    icon: 'bg-[#222725]/10 text-[#222725]',
    hint: 'text-[#3A3F2E]/75',
    meter: 'bg-[#222725]',
  },
  alert: {
    card: 'bg-alert-50 border-alert-200 dark:bg-alert-500/10 dark:border-alert-500/30',
    label: 'text-alert-700/80 dark:text-alert-300/80',
    value: 'text-alert-700 dark:text-alert-200',
    icon: 'bg-alert-600/12 text-alert-600 dark:text-alert-400',
    hint: 'text-alert-700/80 dark:text-alert-300/80',
    meter: 'bg-alert-600',
  },
}

export default function StatsCard({
  title,
  value,
  icon,
  tone = 'neutral',
  hint,
  meter,
  loading = false,
  className = '',
}: {
  title: string
  value: ReactNode
  icon: ReactNode
  tone?: StatTone
  /** Línea chica debajo del número: contexto que evita tener que calcularlo. */
  hint?: string
  /** Proporción 0–100. Para ratios que si no hay que sacar mentalmente. */
  meter?: number
  loading?: boolean
  className?: string
}) {
  const t = TONES[tone]

  return (
    <div className={`rounded-2xl border p-5 flex flex-col ${t.card} ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${t.label}`}>{title}</p>
        <div className={`rounded-xl p-2 shrink-0 ${t.icon}`}>{icon}</div>
      </div>

      <div className="mt-auto">
        {loading ? (
          <div className={`h-8 w-28 rounded-lg animate-pulse ${t.icon}`} />
        ) : (
          <p className={`text-3xl font-black tracking-tight leading-none ${t.value}`}>{value}</p>
        )}

        {meter !== undefined && !loading && (
          <div className={`mt-3 h-1.5 w-full rounded-full overflow-hidden ${t.icon}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${t.meter}`}
              style={{ width: `${Math.min(100, Math.max(0, meter))}%` }}
            />
          </div>
        )}

        {hint && !loading && (
          <p className={`mt-2 text-[11px] font-semibold ${t.hint}`}>{hint}</p>
        )}
      </div>
    </div>
  )
}
