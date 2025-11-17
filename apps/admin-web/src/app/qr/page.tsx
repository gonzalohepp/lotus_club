'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  QrCode,
  Download,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Clock,
} from 'lucide-react'
import AdminLayout from '../layouts/AdminLayout'

function genToken(len = 24) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(len)
    crypto.getRandomValues(arr)
    return Array.from(arr, (b) => ('0' + b.toString(16)).slice(-2)).join('')
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

function mmss(until: Date | null) {
  if (!until) return '--:--'
  const diff = Math.max(0, until.getTime() - Date.now())
  const s = Math.floor(diff / 1000)
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

type PersistedQR = {
  token: string
  nextRefreshAt: string
  ttlHours: number
  autoRefresh: boolean
}

export default function QRAcceso() {
  const [ttlHours, setTtlHours] = useState<number>(24)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const [token, setToken] = useState<string>('')
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  const baseAccessUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/validate` : ''

  const accessUrl = useMemo(() => {
    if (!baseAccessUrl) return ''
    const u = new URL(baseAccessUrl)
    if (token) u.searchParams.set('t', token)
    return u.toString()
  }, [baseAccessUrl, token])

  const qrApiUrl = useMemo(() => {
    if (!accessUrl) return ''
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
      accessUrl
    )}`
  }, [accessUrl])

  const persist = (data: PersistedQR) => {
    try {
      localStorage.setItem('qr_settings', JSON.stringify(data))
    } catch {}
  }

  const load = (): PersistedQR | null => {
    try {
      const raw = localStorage.getItem('qr_settings')
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const regenerate = (opts?: { keepExpiry?: boolean }) => {
    const t = genToken()
    const expiry = opts?.keepExpiry && nextRefreshAt
      ? nextRefreshAt
      : new Date(Date.now() + ttlHours * 60 * 60 * 1000)

    setToken(t)
    setNextRefreshAt(expiry)

    persist({
      token: t,
      nextRefreshAt: expiry.toISOString(),
      ttlHours,
      autoRefresh,
    })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = load()
    if (saved) {
      setTtlHours(saved.ttlHours ?? 24)
      setAutoRefresh(saved.autoRefresh ?? true)
      setToken(saved.token ?? '')
      setNextRefreshAt(saved.nextRefreshAt ? new Date(saved.nextRefreshAt) : null)
      if (!saved.nextRefreshAt || Date.now() >= new Date(saved.nextRefreshAt).getTime()) {
        regenerate()
      }
    } else {
      regenerate()
    }
  }, [])

  useEffect(() => {
    if (tick.current) clearInterval(tick.current)
    tick.current = setInterval(() => {
      if (!autoRefresh || !nextRefreshAt) return
      if (Date.now() >= nextRefreshAt.getTime()) {
        regenerate()
      }
    }, 1000)
    return () => {
      if (tick.current) clearInterval(tick.current)
    }
  }, [autoRefresh, nextRefreshAt, ttlHours])

  const applyTtl = () => {
    const h = Number(ttlHours)
    if (!Number.isFinite(h) || h <= 0) return
    setNextRefreshAt(new Date(Date.now() + h * 60 * 60 * 1000))
    regenerate()
  }

  const downloadQR = async () => {
    if (!qrApiUrl) return
    const response = await fetch(qrApiUrl)
    const blob = await response.blob()

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()

    canvas.width = 600
    canvas.height = 720

    img.onload = () => {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.drawImage(img, 100, 80, 400, 400)

      ctx.fillStyle = '#1e40af'
      ctx.font = 'bold 30px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('ESCANEA PARA INGRESAR', canvas.width / 2, 48)

      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 24px Arial'
      ctx.fillText('Beleza Dojo', canvas.width / 2, 520)
      ctx.font = '18px Arial'
      ctx.fillText('Valida tu acceso', canvas.width / 2, 550)

      if (nextRefreshAt) {
        ctx.font = '16px Arial'
        ctx.fillStyle = '#334155'
        ctx.fillText(
          `Válido hasta: ${nextRefreshAt.toLocaleString('es-AR')}`,
          canvas.width / 2,
          585
        )
      }

      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = 'QR-Acceso-BelezaDojo.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }

    img.src = URL.createObjectURL(blob)
  }

  const printQR = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html>
        <head>
          <title>QR de Acceso - Beleza Dojo</title>
          <style>
            body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; font-family: Arial, sans-serif; }
            .container { text-align:center; padding:40px; }
            h1 { color:#1e40af; margin-bottom:6px; }
            p { color:#64748b; margin:0 0 16px; }
            img { max-width:420px; border:4px solid #1e40af; border-radius:20px; padding:20px; background:white; }
            .foot { margin-top:16px; font-size:16px; color:#334155; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>ESCANEA PARA INGRESAR</h1>
            <p>Valida tu acceso al gimnasio</p>
            <img src="${qrApiUrl}" alt="QR de Acceso" />
            <div class="foot">
              <strong>Beleza Dojo</strong><br/>
              ${nextRefreshAt ? `Válido hasta: ${nextRefreshAt.toLocaleString('es-AR')}` : ''}
            </div>
          </div>
        </body>
      </html>
    `)
    w.document.close()
    setTimeout(() => w.print(), 250)
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Código QR de Acceso</h1>
              <p className="text-slate-600">Imprime este QR y colócalo en la entrada del gimnasio</p>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <input
                  type="number"
                  min={1}
                  className="w-20 rounded-md border px-3 py-2 text-sm"
                  value={ttlHours}
                  onChange={(e) => setTtlHours(Number(e.target.value))}
                />
                <span className="text-sm text-slate-600">horas</span>
                <Button variant="outline" onClick={applyTtl} className="ml-2">
                  Aplicar
                </Button>
              </div>
              <Button onClick={() => regenerate()} className="bg-blue-600 hover:bg-blue-700">
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerar
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="shadow-2xl border-none">
              <CardContent className="p-8">
                <div className="text-center">
                  <div className="inline-block p-6 bg-white rounded-2xl shadow-lg mb-6">
                    {qrApiUrl ? (
                      <img
                        src={qrApiUrl}
                        alt="QR de Acceso"
                        className="w-80 h-80 border-4 border-blue-600 rounded-xl"
                      />
                    ) : (
                      <div className="w-80 h-80 flex items-center justify-center border-4 border-blue-600 rounded-xl">
                        <span className="text-slate-500">Generando…</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-slate-600">
                      {nextRefreshAt ? (
                        <>
                          Válido hasta{' '}
                          <strong>{nextRefreshAt.toLocaleString('es-AR')}</strong> —{' '}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>se renueva en {mmss(nextRefreshAt)}</span>
                          </span>
                        </>
                      ) : (
                        'Sin expiración configurada'
                      )}
                    </p>
                    <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-blue-600"
                        checked={autoRefresh}
                        onChange={(e) => {
                          setAutoRefresh(e.target.checked)
                          persist({
                            token,
                            nextRefreshAt: nextRefreshAt
                              ? nextRefreshAt.toISOString()
                              : new Date().toISOString(),
                            ttlHours,
                            autoRefresh: e.target.checked,
                          })
                        }}
                      />
                      Refrescar automáticamente al expirar
                    </label>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button onClick={downloadQR} className="bg-blue-600 hover:bg-blue-700 w-full" size="lg">
                      <Download className="w-5 h-5 mr-2" />
                      Descargar QR
                    </Button>
                    <Button onClick={printQR} variant="outline" className="w-full" size="lg">
                      <QrCode className="w-5 h-5 mr-2" />
                      Imprimir QR
                    </Button>
                    <Button
                      onClick={() => window.open(accessUrl, '_blank')}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      <ExternalLink className="w-5 h-5 mr-2" />
                      Probar Validación
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-2xl border-none">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Smartphone className="w-6 h-6 text-blue-600" />
                  Instrucciones de Uso
                </h3>

                <div className="space-y-6">
                  {[
                    { n: 1, t: 'Imprimir el QR', d: 'Descargá e imprimí el código QR en un tamaño visible (A4 recomendado).' },
                    { n: 2, t: 'Colocar en la entrada', d: 'Poné el QR impreso en un lugar visible en la entrada del gimnasio.' },
                    { n: 3, t: 'Los miembros escanean', d: 'Al llegar, los miembros escanean el QR con su celular.' },
                    { n: 4, t: 'Validación automática', d: 'El sistema valida automáticamente si pueden ingresar según su estado de pago.' },
                  ].map((s) => (
                    <div key={s.n} className="flex gap-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                        {s.n}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-1">{s.t}</h4>
                        <p className="text-slate-600 text-sm">{s.d}</p>
                      </div>
                    </div>
                  ))}

                  <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-900">
                      <strong>Nota:</strong> Cada QR incluye un token único y expiración configurable. Podés regenerarlo manualmente o dejar activado el refresco automático.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
