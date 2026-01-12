'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  QrCode,
  Download,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Printer
} from 'lucide-react'
import AdminLayout from '../layouts/AdminLayout'

/* ================= HELPERS ================= */

function genToken(len = 24) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(len)
    crypto.getRandomValues(arr)
    return Array.from(arr, (b) => ('0' + b.toString(16)).slice(-2)).join('')
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

function formatTimeLeft(target: Date | null, now: number) {
  if (!target) return '--:--:--'
  const diff = Math.max(0, target.getTime() - now)
  if (diff <= 0) return '00:00:00'

  const h = Math.floor(diff / (1000 * 60 * 60))
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const s = Math.floor((diff % (1000 * 60)) / 1000)

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

type PersistedQR = {
  token: string
  nextRefreshAt: string
  ttlHours: number
  autoRefresh: boolean
}

/* ================= COMPONENT ================= */

export default function QRAcceso() {
  const [ttlHours, setTtlHours] = useState<number>(24)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const [token, setToken] = useState<string>('')
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null)
  const [now, setNow] = useState(Date.now())

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    )}&bgcolor=e2e8f0&color=0f172a` // Slate-200 bg, Slate-900 fg
  }, [accessUrl])

  // ================= EFFECTS =================

  // Load / Init
  useEffect(() => {
    const load = (): PersistedQR | null => {
      try {
        const raw = localStorage.getItem('qr_settings')
        if (!raw) return null
        return JSON.parse(raw)
      } catch {
        return null
      }
    }

    const saved = load()
    if (saved) {
      setTtlHours(saved.ttlHours ?? 24)
      setAutoRefresh(saved.autoRefresh ?? true)
      setToken(saved.token ?? '')

      const expiry = saved.nextRefreshAt ? new Date(saved.nextRefreshAt) : null
      setNextRefreshAt(expiry)

      // If expired on load, regenerate immediately
      if (expiry && Date.now() >= expiry.getTime()) {
        regenerate(saved.ttlHours ?? 24, saved.autoRefresh ?? true)
      }
    } else {
      regenerate(24, true)
    }
  }, [])

  // Timer Ticker & Auto-Refresh
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)

    tickRef.current = setInterval(() => {
      const currentTime = Date.now()
      setNow(currentTime)

      if (autoRefresh && nextRefreshAt && currentTime >= nextRefreshAt.getTime()) {
        regenerate(ttlHours, autoRefresh)
      }
    }, 1000)

    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [autoRefresh, nextRefreshAt, ttlHours])

  // ================= ACTIONS =================

  const persist = (data: PersistedQR) => {
    try {
      localStorage.setItem('qr_settings', JSON.stringify(data))
    } catch { }
  }

  const regenerate = (hours = ttlHours, auto = autoRefresh) => {
    const t = genToken()
    const expiry = new Date(Date.now() + hours * 60 * 60 * 1000)

    setToken(t)
    setNextRefreshAt(expiry)

    persist({
      token: t,
      nextRefreshAt: expiry.toISOString(),
      ttlHours: hours,
      autoRefresh: auto,
    })
  }

  const applyTtl = () => {
    const h = Number(ttlHours)
    if (!Number.isFinite(h) || h <= 0) return
    regenerate(h, autoRefresh)
  }

  const downloadQR = async () => {
    if (!qrApiUrl) return
    const response = await fetch(qrApiUrl)
    const blob = await response.blob()

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()

    canvas.width = 600
    canvas.height = 760

    img.onload = () => {
      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
      grad.addColorStop(0, '#0f172a')
      grad.addColorStop(1, '#1e293b')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Title
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('ACCESO GIMNASIO', canvas.width / 2, 80)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '20px sans-serif'
      ctx.fillText('Escanea este código para ingresar', canvas.width / 2, 115)

      // QR Container
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(90, 150, 420, 420, 24)
      ctx.fill()

      // QR Image
      ctx.drawImage(img, 110, 170, 380, 380)

      // Footer
      ctx.fillStyle = '#3b82f6'
      ctx.font = 'bold 28px sans-serif'
      ctx.fillText('Beleza Dojo', canvas.width / 2, 630)

      if (nextRefreshAt) {
        ctx.fillStyle = '#64748b'
        ctx.font = '16px sans-serif'
        ctx.fillText(
          `Válido hasta: ${nextRefreshAt.toLocaleString('es-AR')}`,
          canvas.width / 2,
          680
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
            body { 
              display:flex; justify-content:center; align-items:center; 
              min-height:100vh; margin:0; 
              font-family: system-ui, -apple-system, sans-serif;
              background: #0f172a;
              color: white;
            }
            .container { 
              text-align:center; padding:60px; 
              background: white; color: #0f172a;
              border-radius: 32px;
              box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }
            h1 { margin:0 0 10px; font-size: 32px; letter-spacing: -1px; }
            p { color:#64748b; margin:0 0 30px; }
            img { 
              width: 300px; height: 300px;
              border: 2px solid #e2e8f0; 
              border-radius: 20px; 
              margin-bottom: 30px;
            }
            .brand { color:#3b82f6; font-size: 24px; font-weight: 800; margin-bottom: 8px; }
            .meta { font-size:14px; color:#94a3b8; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>ACCESO GIMNASIO</h1>
            <p>Escanea el código para validar tu ingreso</p>
            <img src="${qrApiUrl}" alt="QR de Acceso" />
            <div class="brand">Beleza Dojo</div>
            <div class="meta">
              ${nextRefreshAt ? `Válido hasta: ${nextRefreshAt.toLocaleString('es-AR')}` : ''}
            </div>
          </div>
        </body>
      </html>
    `)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  // ================= RENDER =================

  return (
    <AdminLayout active="/qr">
      <div className="relative isolate min-h-screen bg-[#FDFDFD] dark:bg-[#0a0a0a] overflow-hidden transition-colors duration-500">
        {/* Ambient Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] opacity-40 dark:opacity-20" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] opacity-40 dark:opacity-20" />
        </div>

        <div className="relative mx-auto max-w-7xl p-6 md:p-8">

          {/* Header */}
          <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-400/20">
                  Control de Acceso
                </span>
              </div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
                Código <span className="text-blue-600 dark:text-blue-400">QR</span>
              </h1>
              <p className="max-w-md text-slate-500 dark:text-slate-400 font-medium italic">
                Punto de acceso seguro para miembros del dojo.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="pl-3 pr-2 flex items-center gap-2 border-r border-slate-200 dark:border-slate-800">
                <Clock className="w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min={1}
                  className="w-12 bg-transparent text-sm font-bold text-slate-900 dark:text-white text-center focus:outline-none"
                  value={ttlHours}
                  onChange={(e) => setTtlHours(Number(e.target.value))}
                />
                <span className="text-xs font-bold text-slate-400 mr-2">HRS</span>
              </div>
              <button
                onClick={() => applyTtl()}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-colors"
              >
                Aplicar
              </button>
            </motion.div>
          </header>

          <div className="grid lg:grid-cols-2 gap-8 items-start">

            {/* QR Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="group relative overflow-hidden rounded-[40px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 dark:backdrop-blur-xl p-8 lg:p-12 shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="relative mb-8">
                  <div className="absolute -inset-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[32px] blur-lg opacity-30 animate-pulse" />
                  <div className="relative p-6 bg-white rounded-[24px] shadow-sm border border-slate-100">
                    {qrApiUrl ? (
                      <img
                        src={qrApiUrl}
                        alt="QR de Acceso"
                        className="w-64 h-64 md:w-80 md:h-80 object-contain rounded-xl"
                      />
                    ) : (
                      <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center rounded-xl bg-slate-50">
                        <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-emerald-500 text-white shadow-lg flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Activo</span>
                    </div>
                  </div>
                </div>

                <div className="w-full text-center space-y-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Tiempo Restante
                    </p>
                    <div className="font-variant-numeric text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                      {formatTimeLeft(nextRefreshAt, now)}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <label className="flex items-center gap-3 p-3 pl-4 pr-5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-500 transition-colors">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={autoRefresh}
                          onChange={(e) => {
                            setAutoRefresh(e.target.checked)
                            regenerate(ttlHours, e.target.checked)
                          }}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                        Auto-Renovar
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full">
                    <button
                      onClick={downloadQR}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </button>
                    <button
                      onClick={printQR}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir
                    </button>
                  </div>

                  <button
                    onClick={() => regenerate()}
                    className="w-full py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Generar Nuevo Token al Instante
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Instructions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/20 backdrop-blur-xl p-8">
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" />
                  Instrucciones de Instalación
                </h3>
                <div className="space-y-6">
                  {[
                    {
                      icon: <Printer className="w-5 h-5" />,
                      title: 'Imprime en Alta Calidad',
                      desc: 'Descarga el código en formato PNG y utiliza una impresora láser para mayor nitidez. Tamaño recomendado: A4 o A5.'
                    },
                    {
                      icon: <CheckCircle2 className="w-5 h-5" />,
                      title: 'Colocación Estratégica',
                      desc: 'Ubica el código en un soporte vertical a 1.5m de altura en la entrada del gimnasio, evitando reflejos directos.'
                    },
                    {
                      icon: <Smartphone className="w-5 h-5" />,
                      title: 'Validación de Miembros',
                      desc: 'Los alumnos deberán escanear este código con su cámara. El sistema validará su estado de pago automáticamente.'
                    },
                  ].map((step, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:border-blue-200 dark:group-hover:border-blue-800 transition-colors">
                        {step.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {step.title}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-6 flex gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                <div>
                  <h5 className="font-bold text-amber-900 dark:text-amber-400 text-sm mb-1">
                    Seguridad del Token
                  </h5>
                  <p className="text-xs font-medium text-amber-800/70 dark:text-amber-500/70 leading-relaxed">
                    Este código QR contiene un token encriptado que expira automáticamente.
                    Si sospechas que el código ha sido compartido digitalmente, usa el botón
                    &ldquo;Regenerar&rdquo; para invalidar el anterior inmediatamente.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
