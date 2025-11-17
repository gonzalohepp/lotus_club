'use client'
import { ReactNode } from 'react'

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
  const hue =
    color === 'green' ? 'bg-green-100 text-green-700'
    : color === 'red'    ? 'bg-red-100 text-red-700'
    : color === 'purple' ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700'

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-slate-500 text-sm">{title}</div>
        <div className={`rounded-full p-2 ${hue}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold mt-2">
        {loading ? <span className="animate-pulse text-slate-300">•••</span> : value}
      </div>
    </div>
  )
}
