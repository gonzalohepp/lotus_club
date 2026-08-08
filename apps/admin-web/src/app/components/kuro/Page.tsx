'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * Primitivos de layout de Kuro.
 *
 * Existen para que las pantallas queden IGUALES sin depender de que cada página
 * repita bien las mismas clases: antes había 8 combinaciones distintas de
 * tamaño de título y media docena de estilos de tarjeta. Los tamaños, espacios
 * y colores se definen acá una vez.
 */

/* ============================ Cabecera de página ============================ */

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-10 flex flex-col gap-4 border-b border-carbon-200 pb-8 dark:border-white/10 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-black leading-none tracking-tight text-carbon-900 dark:text-white md:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-carbon-500 dark:text-carbon-400">
            {icon}
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

/* ================================= Botones ================================= */

const BTN_BASE =
  'flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none'

/** CTA primario: negro sobre claro, Porcelain sobre oscuro. */
export const btnPrimary =
  `${BTN_BASE} bg-[#121113] text-[#F7F7F2] hover:brightness-150 dark:bg-[#F7F7F2] dark:text-[#121113] dark:hover:brightness-95`

/** Secundario: Palm Leaf, el acento de la marca. */
export const btnSecondary = `${BTN_BASE} bg-[#899878] text-[#121113] hover:brightness-110`

/** Terciario: contorno, para acciones que no compiten. */
export const btnGhost =
  `${BTN_BASE} border border-carbon-200 bg-white text-carbon-900 hover:bg-carbon-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10`

/** Destructivo. */
export const btnDanger =
  `${BTN_BASE} bg-alert-600 text-white hover:bg-alert-700`

/* ============================ Tarjeta de sección ============================ */

/** Chip de ícono de las cabeceras. `tone` marca de qué habla la sección. */
export function IconChip({
  children,
  tone = 'brand',
}: {
  children: ReactNode
  tone?: 'brand' | 'alert' | 'warn' | 'neutral'
}) {
  const tones = {
    brand: 'bg-[#899878]/15 text-[#5F6E50] dark:text-[#899878]',
    alert: 'bg-alert-600/12 text-alert-600 dark:text-alert-400',
    warn: 'bg-warn-600/15 text-warn-700 dark:text-warn-400',
    neutral: 'bg-carbon-900/8 text-carbon-600 dark:bg-white/10 dark:text-carbon-300',
  }
  return <span className={`rounded-lg p-1.5 ${tones[tone]}`}>{children}</span>
}

export function SectionCard({
  title,
  hint,
  icon,
  tone = 'brand',
  action,
  bodyClassName = 'p-3',
  className = '',
  children,
}: {
  title: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'alert' | 'warn' | 'neutral'
  /** Link de "ver todo" a la derecha de la cabecera. */
  action?: { href: string; label: string }
  bodyClassName?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-carbon-200 bg-white dark:border-white/10 dark:bg-white/5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-carbon-200 px-5 py-4 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-carbon-900 dark:text-white">
            {icon && <IconChip tone={tone}>{icon}</IconChip>}
            {title}
          </h2>
          {hint && (
            <p className="mt-1 text-[11px] font-medium text-carbon-500 dark:text-carbon-400">{hint}</p>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#5F6E50] hover:underline dark:text-[#899878]"
          >
            {action.label} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/* ============================== Estado vacío ============================== */

export function EmptyState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && <div className="text-carbon-300 dark:text-carbon-600">{icon}</div>}
      <p className="text-sm font-medium italic text-carbon-400 dark:text-carbon-500">{text}</p>
    </div>
  )
}
