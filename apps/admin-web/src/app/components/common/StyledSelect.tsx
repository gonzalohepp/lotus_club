'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export type SelectOption = { value: string; label: string }

/**
 * Select con dropdown 100% en DOM (Radix), a diferencia de un <select> nativo
 * cuyo popup lo renderiza el browser/SO y no puede tematizarse en dark mode.
 */
export default function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  triggerClassName,
  wrapperClassName,
  contentClassName,
  itemClassName,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  icon?: LucideIcon
  triggerClassName?: string
  wrapperClassName?: string
  contentClassName?: string
  itemClassName?: string
}) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      {Icon && (
        <Icon className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-carbon-400" />
      )}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            'h-11 w-full rounded-2xl border border-carbon-200 dark:border-carbon-700 bg-white dark:bg-carbon-800 px-4 text-sm font-bold text-carbon-700 dark:text-carbon-200 shadow-none hover:bg-carbon-50 dark:hover:bg-carbon-700 focus-visible:ring-4 focus-visible:ring-kuro-500/10 focus-visible:ring-offset-0 focus-visible:border-kuro-500/50 data-[placeholder]:text-carbon-400 dark:data-[placeholder]:text-carbon-500 transition-all',
            Icon && 'pl-11',
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          className={cn(
            'bg-white dark:bg-carbon-800 border-carbon-200 dark:border-carbon-700 rounded-2xl',
            contentClassName
          )}
        >
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className={cn(
                'rounded-lg text-carbon-700 dark:text-carbon-200 focus:bg-kuro-50 dark:focus:bg-carbon-700 cursor-pointer',
                itemClassName
              )}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
