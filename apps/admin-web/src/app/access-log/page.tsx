'use client'

import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../layouts/AdminLayout'
import { AccessLog } from '@/entities/AccessLog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, XCircle, Download, Filter } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

type LogRow = {
  id: string | number
  access_time: string
  member_name: string
  status: 'autorizado' | 'denegado' | string
  reason?: string | null
  // opcional si tu backend lo guarda:
  member_status?: 'activo' | 'inactivo' | 'vencido' | 'suspendido' | string
}

export default function AccessLogPage() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [resultado, setResultado] = useState<'todos' | 'autorizado' | 'denegado'>('todos')
  const [membresia, setMembresia] = useState<'todas' | 'activos' | 'inactivos'>('todas')
  const [q, setQ] = useState<string>('')

  // Rango de fechas (YYYY-MM-DD)
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      setIsLoading(true)
      const data = (await AccessLog.list('-access_time')) as LogRow[]
      setLogs(data ?? [])
      setIsLoading(false)
    })()
  }, [])

  const stats = useMemo(() => {
    const total = logs.length
    const autorizado = logs.filter((l) => l.status === 'autorizado').length
    const denegado = logs.filter((l) => l.status === 'denegado').length
    return { total, autorizado, denegado }
  }, [logs])

  const filteredLogs = useMemo(() => {
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null

    return logs.filter((log) => {
      // por fecha
      const ts = new Date(log.access_time).getTime()
      if (fromTs && ts < fromTs) return false
      if (toTs && ts > toTs) return false

      // por resultado
      if (resultado !== 'todos' && log.status !== resultado) return false

      // por membresía (si viene en el log)
      if (membresia !== 'todas') {
        const ms = (log.member_status || '').toLowerCase()
        if (membresia === 'activos') {
          if (ms && ms !== 'activo') return false
          // si no hay dato de membresía, no excluimos
        } else if (membresia === 'inactivos') {
          if (ms && ms === 'activo') return false
        }
      }

      // por búsqueda de miembro
      if (q) {
        const needle = q.trim().toLowerCase()
        if (!log.member_name?.toLowerCase().includes(needle)) return false
      }

      return true
    })
  }, [logs, from, to, resultado, membresia, q])

  const exportToCSV = () => {
    const rows = filteredLogs.map((log) => [
      format(new Date(log.access_time), 'dd/MM/yyyy HH:mm:ss'),
      log.member_name,
      log.status,
      log.member_status ?? '',
      log.reason ?? '',
    ])

    const headers = ['Fecha y Hora', 'Miembro', 'Resultado', 'Membresía', 'Razón']
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
    <AdminLayout>
      <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Historial de Accesos</h1>
              <p className="text-slate-600">Registro completo de validaciones</p>
            </div>
            <Button variant="outline" onClick={exportToCSV} disabled={filteredLogs.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="shadow-lg border-none">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Total de Accesos</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Filter className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Autorizados</p>
                    <p className="text-3xl font-bold text-green-600">{stats.autorizado}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-xl">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Denegados</p>
                    <p className="text-3xl font-bold text-red-600">{stats.denegado}</p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-xl">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card className="shadow-lg border-none mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por miembro…"
                    className="bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-500">Desde</label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-500">Hasta</label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select value={resultado} onValueChange={(v: any) => setResultado(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Resultado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="autorizado">Autorizados</SelectItem>
                      <SelectItem value="denegado">Denegados</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={membresia} onValueChange={(v: any) => setMembresia(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Membresía" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="activos">Activos</SelectItem>
                      <SelectItem value="inactivos">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla */}
          <Card className="shadow-lg border-none">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Registro de Validaciones</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Fecha y Hora</TableHead>
                      <TableHead>Miembro</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Membresía</TableHead>
                      <TableHead>Razón</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                          </TableRow>
                        ))
                      : filteredLogs.map((log) => (
                          <TableRow key={log.id} className="hover:bg-slate-50">
                            <TableCell className="font-medium">
                              {format(new Date(log.access_time), "d MMM yyyy, HH:mm:ss", { locale: es })}
                            </TableCell>
                            <TableCell>{log.member_name}</TableCell>
                            <TableCell>
                              <Badge
                                className={`${
                                  log.status === 'autorizado'
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'bg-red-100 text-red-800 border-red-200'
                                } border`}
                              >
                                {log.status === 'autorizado' ? (
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                ) : (
                                  <XCircle className="w-3 h-3 mr-1" />
                                )}
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize text-slate-700">
                              {log.member_status ?? '—'}
                            </TableCell>
                            <TableCell className="text-slate-600">{log.reason ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
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
