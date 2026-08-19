'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Printer,
  Maximize2,
  Minimize2,
  Lock,
  Unlock
} from 'lucide-react'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

import GuestAccessDialog from '../components/qr/GuestAccessDialog'

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

/* ================= COMPONENT ================= */

/* ================= COMPONENT ================= */
export default function QRAcceso() {
  // El QR de acceso es de una sede concreta: un token generado en Lanús no
  // debe abrirle la puerta a nadie en Quilmes. El rol también sale de la sede
  // activa, no de `profiles.role`, para que sólo su admin cambie la config.
  const { activeDojo, allows } = useTenant()
  const dojoId = activeDojo?.id

  const [token, setToken] = useState<string>('')
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null)
  const [now, setNow] = useState(Date.now())
  const [autoRefresh, setAutoRefresh] = useState(true)

  /**
   * Quién puede cambiar el modo del QR y regenerarlo: el administrador de ESTA
   * sede. Antes era `role === 'admin'`, y el rol de sede de un Mestre o un
   * Coordinador regional es un `admin` sintético heredado de la marca, así que
   * les aparecía el interruptor de fijo/rotativo de todas las sucursales.
   * Decidir si el código de la puerta se imprime o se renueva es de quien
   * atiende esa puerta.
   */
  const isAdmin = allows('manageQrMode')

  // Confirmación antes de cambiar el modo del QR: es una decisión operativa que
  // deja inservible el código anterior, así que no debe pasar de un click suelto.
  const [showModeConfirm, setShowModeConfirm] = useState(false)
  const [switchingMode, setSwitchingMode] = useState(false)
  const [modeError, setModeError] = useState<string | null>(null)

  /**
   * Aplica el cambio de modo. Se llama sólo desde la confirmación.
   *
   * Al pasar a ROTATIVO se genera un token nuevo, con lo cual el QR impreso que
   * estuviera pegado en la puerta deja de validar. Al pasar a FIJO se reutiliza
   * el token fijo vigente si lo hay, para no obligar a reimprimir cada vez que
   * alguien toca el interruptor sin querer.
   */
  const applyModeChange = useCallback(async () => {
    const nextAuto = !autoRefresh
    setSwitchingMode(true)

    try {
      /*
       * Vía RPC y no `update` directo sobre `dojos`. La tabla está cerrada al
       * desarrollador (la ficha de la sede la maneja la marca), así que el
       * update se filtraba por RLS y PostgREST devolvía 204 SIN error: el
       * interruptor se movía en pantalla y la base quedaba igual, y recién se
       * notaba al recargar. `set_qr_mode` valida el permiso y falla fuerte.
       */
      const { error: modeErr } = await supabase.rpc('set_qr_mode', {
        target: dojoId ?? NO_DOJO,
        fixed: !nextAuto,
      })

      if (modeErr) {
        console.error('[qr] no se pudo guardar el modo en la sede:', modeErr)
        setModeError(
          modeErr.code === '42501'
            ? 'Sólo el administrador de esta sede puede cambiar el modo del QR.'
            : 'No se pudo guardar el cambio. Probá de nuevo.'
        )
        // Sin cerrar el diálogo: si se cierra, el mensaje se va con él y el
        // cambio parece haber funcionado.
        setSwitchingMode(false)
        return
      }

      setModeError(null)
      setAutoRefresh(nextAuto)

      if (!nextAuto) {
        const { data } = await supabase
          .from('qr_tokens')
          .select('token, expires_at')
          .eq('dojo_id', dojoId ?? NO_DOJO)
          .eq('is_fixed', true)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (data) {
          setToken(data.token)
          setNextRefreshAt(new Date(data.expires_at))
        } else {
          await regenerate(false)
        }
      } else {
        await regenerate(true)
      }
    } finally {
      setSwitchingMode(false)
      setShowModeConfirm(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, dojoId])

  // ================= ACTIONS =================
  const regenerate = useCallback(async (isAutoOverride?: boolean) => {
    const t = genToken()
    // Use the override value if provided (for state transition), otherwise use current state
    const currentAuto = isAutoOverride !== undefined ? isAutoOverride : autoRefresh

    // If autoRefresh is disabled, use a very long expiry (1 year)
    const durationMs = currentAuto ? 30 * 1000 : 365 * 24 * 60 * 60 * 1000
    const expiry = new Date(Date.now() + durationMs)

    const { error } = await supabase.from('qr_tokens').insert({
      dojo_id: dojoId,
      token: t,
      expires_at: expiry.toISOString(),
      is_fixed: !currentAuto
    })

    if (error) {
      console.error('Error creating QR token:', error)
      return
    }

    setToken(t)
    setNextRefreshAt(expiry)
  }, [autoRefresh, dojoId])

  // El modo (fijo / rotativo) es un atributo de la SEDE, no del navegador:
  // la tablet de la puerta y la laptop del admin tienen que coincidir.
  useEffect(() => {
    if (!dojoId) return

    const isAuto = !(activeDojo?.qr_fixed ?? false)
    setAutoRefresh(isAuto)

    if (!isAuto) {
      // Modo fijo: buscar token fijo activo en Supabase
      supabase
        .from('qr_tokens')
        .select('token, expires_at')
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .eq('is_fixed', true)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            // Token fijo existente, reusar
            setToken(data.token)
            setNextRefreshAt(new Date(data.expires_at))
          } else {
            // No hay token fijo, generar uno nuevo
            regenerate(false)
          }
        })
    } else {
      regenerate(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dojoId, activeDojo?.qr_fixed])


  // UI State for Guest Access
  const [showGuestConfirm, setShowGuestConfirm] = useState(false)
  const [fullScreen, setFullScreen] = useState(false)

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
    )}&bgcolor=e2e8f0&color=0f172a`
  }, [accessUrl])

  // Timer Ticker & Auto-Refresh loop
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)

    tickRef.current = setInterval(() => {
      const currentTime = Date.now()
      setNow(currentTime)

      // Auto refresh if expired AND autoRefresh is enabled
      if (autoRefresh && nextRefreshAt && currentTime >= nextRefreshAt.getTime()) {
        regenerate()
      }
    }, 1000)

    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [nextRefreshAt, autoRefresh, regenerate])

  // Wake Lock for Kiosk Mode
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
          console.log('Wake Lock active')
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? `${err.name}, ${err.message}` : 'Unknown error'
        console.error(message)
      }
    }

    requestWakeLock()

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (wakeLock !== null) wakeLock.release()
    }
  }, [])


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
      grad.addColorStop(0, '#222725')
      grad.addColorStop(1, '#2C322E')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Title
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      // Igual que en la versión imprimible: la marca sale de la sede activa,
      // no fija. Antes el PNG descargado decía "BELEZA DOJO" para cualquiera.
      ctx.fillText(`ACCESO A ${(activeDojo?.name ?? 'TU DOJO').toUpperCase()}`, canvas.width / 2, 80)

      ctx.fillStyle = '#A4A5A0'
      ctx.font = '20px sans-serif'
      ctx.fillText('Escaneá este código para ingresar', canvas.width / 2, 115)

      // QR Container
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(90, 150, 420, 420, 24)
      ctx.fill()

      // QR Image
      ctx.drawImage(img, 110, 170, 380, 380)

      // Footer
      ctx.fillStyle = '#899878'
      ctx.font = 'bold 28px sans-serif'
      // El cartel impreso lleva el nombre de la sede: es lo que le sirve a
      // quien lo pega en la puerta y a quien lo escanea.
      ctx.fillText(activeDojo?.name ?? 'Dojo', canvas.width / 2, 630)

      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = `QR-Acceso-${(activeDojo?.slug ?? 'dojo')}.png`
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
          <title>QR de Acceso - ${activeDojo?.name ?? 'Dojo'}</title>
          <style>
            body { 
              display:flex; justify-content:center; align-items:center; 
              min-height:100vh; margin:0; 
              font-family: system-ui, -apple-system, sans-serif;
              background: #222725;
              color: white;
            }
            .container { 
              text-align:center; padding:60px; 
              background: white; color: #222725;
              border-radius: 32px;
              box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }
            h1 { margin:0 0 10px; font-size: 32px; letter-spacing: -1px; }
            p { color:#848580; margin:0 0 30px; }
            img { 
              width: 300px; height: 300px;
              border: 2px solid #DCDDD8; 
              border-radius: 20px; 
              margin-bottom: 30px;
            }
            .brand { color:#899878; font-size: 24px; font-weight: 800; margin-bottom: 8px; }
            .meta { font-size:14px; color:#A4A5A0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>ACCESO A ${(activeDojo?.name ?? 'TU DOJO').toUpperCase()}</h1>
            <p>Escaneá el código para validar tu ingreso</p>
            <img src="${qrApiUrl}" alt="QR de Acceso" />
            <div class="brand">${activeDojo?.name ?? 'Dojo'}</div>
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
      <div className="relative isolate min-h-screen bg-[#F7F7F2] dark:bg-[#121113] overflow-hidden transition-colors duration-500">
        {/* Ambient Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-kuro-500/10 rounded-full blur-[120px] opacity-40 dark:opacity-20" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-kuro-500/10 rounded-full blur-[120px] opacity-40 dark:opacity-20" />
        </div>

        <div className="relative">

          {/* Header */}
          <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-full bg-kuro-50 dark:bg-kuro-900/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-kuro-600 dark:text-kuro-400 ring-1 ring-inset ring-kuro-600/20 dark:ring-kuro-400/20">
                  Control de Acceso
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
                Código <span className="text-kuro-600 dark:text-kuro-400">QR</span>
              </h1>
              <p className="max-w-md text-carbon-500 dark:text-carbon-400 font-medium italic">
                Punto de acceso seguro para alumnos del dojo.
              </p>
            </motion.div>

            {isAdmin && (
              <motion.button
                onClick={() => setShowModeConfirm(true)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-3 p-2 rounded-2xl border shadow-sm transition-all ${autoRefresh
                  ? 'bg-kuro-50 dark:bg-kuro-900/20 border-kuro-200 dark:border-kuro-800'
                  : 'bg-warn-50 dark:bg-warn-900/20 border-warn-200 dark:border-warn-800'
                  }`}
              >
                <div className={`px-4 py-2 flex items-center gap-2 ${autoRefresh ? 'text-kuro-700 dark:text-kuro-400' : 'text-warn-700 dark:text-warn-400'
                  }`}>
                  {autoRefresh ? (
                    <Unlock className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {autoRefresh ? 'Auto-Renovación Activa' : 'QR Fijo para Imprimir'}
                  </span>
                </div>
              </motion.button>
            )}
          </header>

          <div className="grid lg:grid-cols-2 gap-8 items-start">

            {/* QR Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-carbon-200 dark:border-carbon-800 bg-white dark:bg-carbon-900/50 dark:backdrop-blur-xl p-8 lg:p-12 shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-kuro-500/5 to-kuro-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="relative mb-8">
                  <div className="absolute -inset-4 bg-gradient-to-br from-kuro-600 to-kuro-600 rounded-2xl blur-lg opacity-30 animate-pulse" />
                  <div className="relative p-6 bg-white rounded-[24px] shadow-sm border border-carbon-100">
                    {qrApiUrl ? (
                      <img
                        src={qrApiUrl}
                        alt="QR de Acceso"
                        className="w-64 h-64 md:w-80 md:h-80 object-contain rounded-xl"
                      />
                    ) : (
                      <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center rounded-xl bg-carbon-50">
                        <RefreshCw className="w-8 h-8 text-carbon-300 animate-spin" />
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 ${autoRefresh
                      ? 'bg-kuro-500 text-white'
                      : 'bg-warn-500 text-white'
                      }`}>
                      {autoRefresh ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Activo</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Fijo</span>
                        </>
                      )}
                    </div>

                    {/* Fullscreen Toggle Button */}
                    <button
                      onClick={() => setFullScreen(true)}
                      className="absolute -top-3 -right-3 p-3 rounded-2xl bg-carbon-900 text-white shadow-xl hover:scale-110 active:scale-95 transition-all"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="w-full text-center space-y-6">
                  <div>
                    <p className="text-xs font-bold text-carbon-400 uppercase tracking-widest mb-1">
                      {autoRefresh ? 'Tiempo Restante' : 'Validez'}
                    </p>
                    <div className="font-variant-numeric text-4xl font-black text-carbon-900 dark:text-white tabular-nums tracking-tight">
                      {autoRefresh ? formatTimeLeft(nextRefreshAt, now) : '∞ PERMANENTE'}
                    </div>
                    {!autoRefresh && (
                      <p className="text-xs text-warn-600 dark:text-warn-400 font-bold mt-2">
                        Este QR es válido de forma permanente
                      </p>
                    )}
                  </div>



                  {isAdmin && !autoRefresh && (
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <button
                        onClick={downloadQR}
                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-carbon-900 dark:bg-white text-white dark:text-carbon-900 font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-carbon-900/20"
                      >
                        <Download className="w-4 h-4" />
                        Descargar
                      </button>
                      <button
                        onClick={printQR}
                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 text-carbon-900 dark:text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir
                      </button>
                    </div>
                  )}


                  <button
                    onClick={() => setShowGuestConfirm(true)}
                    className="w-full py-4 rounded-2xl bg-kuro-50 dark:bg-kuro-900/10 border border-kuro-200 dark:border-kuro-800 text-kuro-700 dark:text-kuro-400 font-bold text-sm hover:bg-kuro-100 dark:hover:bg-kuro-900/20 transition-all flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-kuro-500/10 opacity-0 hover:opacity-100 transition-opacity" />
                    <CheckCircle2 className="w-4 h-4" />
                    Registrar Acceso Invitado
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => regenerate()}
                      className="w-full py-3 rounded-2xl bg-kuro-50 dark:bg-kuro-900/20 text-kuro-600 dark:text-kuro-400 text-xs font-black uppercase tracking-widest hover:bg-kuro-100 dark:hover:bg-kuro-900/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Generar Nuevo Token al Instante
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Instructions */}
            {isAdmin && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-carbon-200 dark:border-carbon-800 bg-white/50 dark:bg-carbon-900/20 backdrop-blur-xl p-8">
                  <h3 className="text-lg font-black text-carbon-900 dark:text-white mb-6 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-kuro-500" />
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
                        title: 'Validación de Alumnos',
                        desc: 'Los alumnos deberán escanear este código con su cámara. El sistema validará su estado de pago automáticamente.'
                      },
                    ].map((step, idx) => (
                      <div key={idx} className="flex gap-4 group">
                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white dark:bg-carbon-800 shadow-sm border border-carbon-100 dark:border-carbon-700 flex items-center justify-center text-carbon-400 group-hover:text-kuro-500 group-hover:border-kuro-200 dark:group-hover:border-kuro-800 transition-colors">
                          {step.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-carbon-900 dark:text-white mb-1 group-hover:text-kuro-600 dark:group-hover:text-kuro-400 transition-colors">
                            {step.title}
                          </h4>
                          <p className="text-sm text-carbon-500 dark:text-carbon-400 leading-relaxed font-medium">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`rounded-3xl border p-6 flex gap-4 ${autoRefresh
                  ? 'bg-warn-50 dark:bg-warn-900/10 border-warn-100 dark:border-warn-900/20'
                  : 'bg-kuro-50 dark:bg-kuro-900/10 border-kuro-100 dark:border-kuro-900/20'
                  }`}>
                  <AlertCircle className={`w-6 h-6 flex-shrink-0 ${autoRefresh
                    ? 'text-warn-600 dark:text-warn-500'
                    : 'text-kuro-600 dark:text-kuro-500'
                    }`} />
                  <div>
                    <h5 className={`font-bold text-sm mb-1 ${autoRefresh
                      ? 'text-warn-900 dark:text-warn-400'
                      : 'text-kuro-900 dark:text-kuro-400'
                      }`}>
                      {autoRefresh ? 'Seguridad del Token' : 'Modo QR Fijo'}
                    </h5>
                    <p className={`text-xs font-medium leading-relaxed ${autoRefresh
                      ? 'text-warn-800/70 dark:text-warn-500/70'
                      : 'text-kuro-800/70 dark:text-kuro-500/70'
                      }`}>
                      {autoRefresh
                        ? 'Este código QR contiene un token que expira automáticamente cada 30 segundos para mayor seguridad. Si sospechas que el código ha sido compartido digitalmente, usa el botón "Regenerar" para invalidarlo inmediatamente.'
                        : 'El QR está configurado en modo FIJO, ideal para imprimir y colocar en la entrada. Este código NO expira y funcionará permanentemente. Podés imprimirlo con confianza. Click en el toggle arriba para volver al modo auto-renovación si lo necesitás.'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>


      {/* Confirmación de cambio de modo del QR */}
      <Dialog open={showModeConfirm} onOpenChange={setShowModeConfirm}>
        <DialogContent className="sm:max-w-lg bg-carbon-900 border-white/10 text-white rounded-3xl p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader>
              <div className={`w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center ${autoRefresh ? 'bg-warn-500/15 text-warn-400' : 'bg-kuro-500/15 text-kuro-400'
                }`}>
                {autoRefresh ? <Lock className="w-7 h-7" /> : <Unlock className="w-7 h-7" />}
              </div>

              <DialogTitle className="text-2xl font-black text-white text-center">
                {autoRefresh ? 'Fijar el código QR' : 'Volver al QR rotativo'}
              </DialogTitle>

              <DialogDescription className="text-carbon-400 text-center text-sm mt-2">
                Este cambio aplica a <span className="font-bold text-white">{activeDojo?.name ?? 'esta sede'}</span> y
                a todos los dispositivos que la abran.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-3">
              {autoRefresh ? (
                <>
                  <p className="flex gap-3 text-sm text-carbon-300">
                    <span className="text-kuro-400 shrink-0">✓</span>
                    Vas a poder <b>imprimir el código</b> y pegarlo en la puerta. No hace falta pantalla ni tablet.
                  </p>
                  <p className="flex gap-3 text-sm text-carbon-300">
                    <span className="text-kuro-400 shrink-0">✓</span>
                    El mismo código sigue sirviendo <b>durante un año</b>.
                  </p>
                  <p className="flex gap-3 text-sm text-warn-300/90">
                    <span className="shrink-0">⚠</span>
                    Como no cambia, quien le saque una foto <b>puede compartirla</b> y ese código va a seguir
                    validando. Igual el ingreso exige estar logueado, activo y pertenecer a esta sede.
                  </p>
                </>
              ) : (
                <>
                  <p className="flex gap-3 text-sm text-carbon-300">
                    <span className="text-kuro-400 shrink-0">✓</span>
                    El código pasa a <b>renovarse cada 30 segundos</b>, así que una foto deja de servir enseguida.
                  </p>
                  <p className="flex gap-3 text-sm text-alert-300">
                    <span className="shrink-0">⚠</span>
                    <span>
                      <b>El QR impreso que tengas pegado deja de funcionar.</b> Hay que retirarlo.
                    </span>
                  </p>
                  <p className="flex gap-3 text-sm text-warn-300/90">
                    <span className="shrink-0">⚠</span>
                    Necesitás una <b>pantalla o tablet en la puerta</b> mostrando esta página. Sin eso nadie puede
                    escanear.
                  </p>
                </>
              )}
            </div>

            {modeError && (
              <p className="mt-6 rounded-xl border border-alert-500/30 bg-alert-500/10 px-4 py-3 text-sm font-medium text-alert-300">
                {modeError}
              </p>
            )}

            <DialogFooter className="flex-col gap-3 sm:flex-col mt-8">
              <Button
                onClick={applyModeChange}
                disabled={switchingMode}
                className={`w-full h-12 rounded-xl font-bold tracking-wide text-white ${autoRefresh ? 'bg-warn-600 hover:bg-warn-500' : 'bg-kuro-600 hover:bg-kuro-500'
                  }`}
              >
                {switchingMode
                  ? 'Aplicando…'
                  : autoRefresh
                    ? 'Sí, fijar el código'
                    : 'Sí, volver a rotativo'}
              </Button>
              <Button
                onClick={() => setShowModeConfirm(false)}
                disabled={switchingMode}
                variant="ghost"
                className="w-full h-11 rounded-xl text-carbon-400 hover:text-white hover:bg-white/5"
              >
                Cancelar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alta de invitado: distingue clase de prueba de visita de otra sede,
          y deja registrado quién autorizó. Ver GuestAccessDialog. */}
      <GuestAccessDialog
        open={showGuestConfirm}
        onOpenChange={setShowGuestConfirm}
        dojoId={dojoId}
      />
      {/* Fullscreen QR Overlay */}
      <AnimatePresence>
        {fullScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-carbon-950 flex flex-col items-center justify-center p-8"
          >
            <div className="absolute inset-0 opacity-20 overflow-hidden pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-kuro-600 rounded-full blur-[150px]" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-kuro-600 rounded-full blur-[150px]" />
            </div>

            <button
              onClick={() => setFullScreen(false)}
              className="absolute top-8 right-8 p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Minimize2 className="w-8 h-8" />
            </button>

            <div className="relative z-10 text-center space-y-8 max-w-2xl w-full">
              <h2 className="text-4xl font-black text-white tracking-tight">ESCANEÁ PARA ENTRAR</h2>
              <div className="relative aspect-square w-full max-w-lg mx-auto p-8 bg-white rounded-[3rem] shadow-2xl shadow-kuro-500/20">
                <img src={qrApiUrl} className="w-full h-full object-contain" alt="QR Fullscreen" />
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-8 py-3 rounded-2xl bg-kuro-500 text-white font-black text-lg shadow-xl">
                  ACTIVO
                </div>
              </div>
              <div className="pt-8">
                <p className="text-carbon-500 font-bold uppercase tracking-widest text-sm mb-2">
                  {autoRefresh ? 'Renovación automática segura' : 'Código QR Fijo Permanente'}
                </p>
                <div className="text-5xl font-black text-white tabular-nums">
                  {autoRefresh ? formatTimeLeft(nextRefreshAt, now) : '∞ PERMANENTE'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout >
  )
}
