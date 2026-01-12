'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CheckCircle, XCircle, Download, Search,
  Calendar, ChevronLeft, ChevronRight,
  ShieldCheck, ShieldAlert, History
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '../layouts/AdminLayout'

const ITEMS_PER_PAGE = 10

type LogRow = {
  id: string | number
  scanned_at: string
  member_name: string
  result: 'autorizado' | 'denegado' | string
  reason?: string | null
  member_id: string
}

export default function AccessLogPage() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  // Filtros
  const [resultado, setResultado] = useState<'todos' | 'autorizado' | 'denegado'>('todos')
  const [q, setQ] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  const fetchLogs = async () => {
    setIsLoading(true)

    // Fetch with profiles join to get member name
    const { data, error } = await supabase
      .from('access_logs')
      .select(`
        *,
        profiles!access_logs_user_id_fkey (
          first_name,
          last_name
        )
      `)
      .order('scanned_at', { ascending: false })

    if (error) {
      console.error('Error fetching logs:', error)
      setLogs([])
    } else {
      const mapped = (data || []).map((l: { id: string | number; scanned_at: string; result: string; reason?: string | null; user_id: string; profiles?: { first_name?: string; last_name?: string } | null }) => ({
        id: l.id,
        scanned_at: l.scanned_at,
        member_name: l.profiles ? `${l.profiles.first_name || ''} ${l.profiles.last_name || ''}`.trim() : 'Desconocido',
        result: l.result,
        reason: l.reason,
        member_id: l.user_id
      }))
      setLogs(mapped)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const stats = useMemo(() => {
    const total = logs.length
    const autorizado = logs.filter((l) => l.result === 'autorizado').length
    const denegado = logs.filter((l) => l.result === 'denegado').length
    return { total, autorizado, denegado }
  }, [logs])

  const filteredLogs = useMemo(() => {
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null

    return logs.filter((log) => {
      const ts = new Date(log.scanned_at).getTime()
      if (fromTs && ts < fromTs) return false
      if (toTs && ts > toTs) return false

      if (resultado !== 'todos' && log.result !== resultado) return false

      if (q) {
        const needle = q.trim().toLowerCase()
        if (!log.member_name?.toLowerCase().includes(needle)) return false
      }

      return true
    })
  }, [logs, from, to, resultado, q])

  // Pagination Logic
  const { totalPages, paginatedLogs, startIndex, endIndex } = useMemo(() => {
    const total = filteredLogs.length
    const pages = Math.ceil(total / ITEMS_PER_PAGE) || 1
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    const end = Math.min(start + ITEMS_PER_PAGE, total)
    return {
      totalPages: pages,
      paginatedLogs: filteredLogs.slice(start, end),
      startIndex: total === 0 ? 0 : start + 1,
      endIndex: end
    }
  }, [filteredLogs, currentPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [q, from, to, resultado])

  const exportToCSV = () => {
    const rows = filteredLogs.map((log) => [
      format(new Date(log.scanned_at), 'dd/MM/yyyy HH:mm:ss'),
      log.member_name,
      log.result,
      log.reason ?? '',
    ])

    const headers = ['Fecha y Hora', 'Miembro', 'Resultado', 'Razón']
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accesos_${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <AdminLayout active="/access-log">
      {/* Background Decor */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[5%] top-[10%] h-[40%] w-[40%] rounded-full bg-blue-500/5 blur-[120px]" />
        <div className="absolute -right-[5%] bottom-[10%] h-[35%] w-[35%] rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl p-6 md:p-8">
        {/* Header */}
        <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-400/20">
                Seguridad
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl uppercase">
              Historial de <span className="text-blue-600 dark:text-blue-400">Accesos</span>
            </h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Registro cronológico de validaciones y perímetros.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <button
              onClick={exportToCSV}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-2 h-14 px-8 rounded-2xl bg-slate-900 dark:bg-slate-700 text-white font-black uppercase tracking-widest text-xs hover:bg-slate-800 dark:hover:bg-slate-600 transition-all shadow-xl hover:shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Exportar Log
            </button>
          </motion.div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-10">
          <StatCard
            label="Validaciones Totales"
            value={stats.total}
            icon={<History />}
            color="blue"
            loading={isLoading}
          />
          <StatCard
            label="Accesos Autorizados"
            value={stats.autorizado}
            icon={<ShieldCheck />}
            color="emerald"
            loading={isLoading}
            pulse
          />
          <StatCard
            label="Intentos Denegados"
            value={stats.denegado}
            icon={<ShieldAlert />}
            color="rose"
            loading={isLoading}
          />
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 shadow-2xl"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-center">
            <div className="md:col-span-4 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre de socio..."
                className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 pl-11 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all"
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="flex-1 h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Al</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            <div className="md:col-span-2 relative group">
              <SelectUi
                value={resultado}
                onChange={(v) => setResultado(v as typeof resultado)}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'autorizado', label: 'Autorizados' },
                  { value: 'denegado', label: 'Denegados' }
                ]}
              />
            </div>
          </div>
        </motion.div>

        {/* Table Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="overflow-hidden rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fecha y Hora</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Socio</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Resultado</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Razón / Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                <AnimatePresence mode="popLayout">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : paginatedLogs.length > 0 ? (
                    paginatedLogs.map((log, idx) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors group"
                      >
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 transition-colors">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              {format(new Date(log.scanned_at), "d 'de' MMMM, HH:mm", { locale: es })}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {log.member_name}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${log.result === 'autorizado'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/30'
                            : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/30'
                            }`}>
                            {log.result === 'autorizado' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {log.result}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {log.reason || '—'}
                          </span>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <Search className="w-8 h-8" />
                          </div>
                          <p className="text-slate-400 font-bold">No se encontraron registros que coincidan.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Resultados: <span className="text-slate-900 dark:text-white">{startIndex} - {endIndex}</span> de <span className="text-slate-900 dark:text-white">{filteredLogs.length}</span>
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 transition-all shadow-sm"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-1">
                  {(() => {
                    const pages = []
                    const maxVisible = 5

                    if (totalPages <= maxVisible + 2) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i)
                    } else {
                      pages.push(1)

                      let start = Math.max(2, currentPage - 1)
                      let end = Math.min(totalPages - 1, currentPage + 1)

                      if (currentPage <= 3) end = 4
                      if (currentPage >= totalPages - 2) start = totalPages - 3

                      if (start > 2) pages.push('...')
                      for (let i = start; i <= end; i++) pages.push(i)
                      if (end < totalPages - 1) pages.push('...')

                      pages.push(totalPages)
                    }

                    return pages.map((pageNum, idx) => {
                      if (pageNum === '...') {
                        return <span key={`dots-${idx}`} className="w-10 h-10 flex items-center justify-center text-slate-400 font-bold">...</span>
                      }

                      const isActive = currentPage === pageNum
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum as number)}
                          className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${isActive
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-blue-200 hover:text-blue-600'
                            }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })
                  })()}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 transition-all shadow-sm"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AdminLayout>
  )
}

/* =============== subcomponentes =============== */

function StatCard({ label, value, icon, color, loading, pulse }: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: 'blue' | 'emerald' | 'rose'
  loading: boolean
  pulse?: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-500/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-500/10 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30',
    rose: 'bg-rose-50 text-rose-600 ring-rose-500/10 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-500/30'
  }

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="group relative overflow-hidden rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm transition-all hover:shadow-2xl"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-4 rounded-2xl ${colors[color]} ring-1 ring-inset relative`}>
          {icon}
          {pulse && !loading && (
            <span className="absolute top-0 right-0 h-3 w-3 -mr-1 -mt-1 flex">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          )}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">{label}</p>
          <div className="text-3xl font-black text-slate-900 dark:text-white leading-none">
            {loading ? <div className="h-8 w-20 bg-slate-100 dark:bg-slate-700 animate-pulse rounded-lg mt-1" /> : value}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function SelectUi({ value, onChange, options }: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 pr-10 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500/50 transition-all cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
        <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
      </div>
    </div>
  )

}

function SkeletonRow() {
  return (
    <tr>
      <td className="px-8 py-5"><div className="h-4 w-32 bg-slate-100 animate-pulse rounded" /></td>
      <td className="px-8 py-5"><div className="h-4 w-40 bg-slate-100 animate-pulse rounded" /></td>
      <td className="px-8 py-5"><div className="h-8 w-24 bg-slate-100 animate-pulse rounded-full" /></td>
      <td className="px-8 py-5"><div className="h-4 w-48 bg-slate-100 animate-pulse rounded" /></td>
    </tr>
  )
}

/** Escapa comas y comillas para CSV */
function escapeCsv(v: unknown): string {
  const s = `${v ?? ''}`
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
