'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle, XCircle, RefreshCw, Camera, ShieldCheck, Zap } from 'lucide-react'
import QRScannerHtml5 from '@/components/QRScannerHtml5'
import { motion, AnimatePresence } from 'framer-motion'

export const dynamic = 'force-dynamic'

type MemberRow = {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  access_code: string | null
  status?: string | null
}

const fullName = (m: MemberRow | null) =>
  m ? [m.first_name ?? '', m.last_name ?? ''].join(' ').trim() || 'Miembro' : 'Miembro'

// 🔒 Política: sólo aceptamos QR de este sitio con ?t=<token>
const ACCEPT_ONLY_SITE_TOKEN = true

function getAllowedOrigins(): string[] {
  const origins = new Set<string>()
  if (typeof window !== 'undefined') origins.add(window.location.origin)
  // Si definiste NEXT_PUBLIC_SITE_URL, se respeta también
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      const o = new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
      origins.add(o)
    } catch { }
  }
  return Array.from(origins)
}

function parseSiteToken(raw: string): { ok: boolean; token?: string } {
  try {
    const u = new URL(raw)
    const allowed = getAllowedOrigins()
    const isOurOrigin = allowed.includes(u.origin)
    const isValidatePath = u.pathname === '/validate' || u.pathname.startsWith('/validate/')
    const token = u.searchParams.get('t') || undefined
    if (isOurOrigin && isValidatePath && token) {
      return { ok: true, token }
    }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

function ValidateContent() {
  const router = useRouter()
  const qp = useSearchParams()

  // Estado UI
  const [paused, setPaused] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Resultado
  const [openResult, setOpenResult] = useState(false)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [resultMsg, setResultMsg] = useState('')

  // Datos usuario / miembro
  const [member, setMember] = useState<MemberRow | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Anti-loop
  const processingRef = useRef(false)
  const lastTextRef = useRef<string | null>(null)
  const lastAtRef = useRef<number>(0)

  // ========= Sesión y preload del miembro ========
  useEffect(() => {
    ; (async () => {
      const { data } = await supabase.auth.getUser()
      const email = data.user?.email ?? null
      setUserEmail(email)
      if (!email) {
        router.replace('/login')
        return
      }
      const { data: rows, error } = await supabase
        .from('members_with_status')
        .select('*')
        .ilike('email', email)
        .limit(1)

      if (error) console.error('[validate] preload error', error)
      setMember((rows?.[0] as MemberRow) ?? null)
    })()
  }, [router])

  // ========= Validación =========
  const validateAccess = useCallback(
    async (rawText: string) => {
      if (processingRef.current) return
      processingRef.current = true

      try {
        // 1) Chequear que el QR sea válido según nuestra política
        const site = parseSiteToken(rawText)

        if (ACCEPT_ONLY_SITE_TOKEN) {
          if (!site.ok) {
            // QR de otro origen o sin ?t= => denegado sin consultar DB
            setAllowed(false)
            setResultMsg('QR inválido')
            setOpenResult(true)
            return
          }
          // (Opcional) acá podrías validar el token contra backend si más adelante lo guardás.
        } else {
          // (modo flexible, no lo usamos ahora)
          if (!site.ok) {
            setAllowed(false)
            setResultMsg('QR inválido')
            setOpenResult(true)
            return
          }
        }

        // 2) Verificación de membresía del usuario logueado
        //    (Si llegaste acá, el QR pasó el filtro de dominio + token)
        const emailToCheck = userEmail || member?.email || undefined

        if (!emailToCheck) {
          setAllowed(false)
          setResultMsg('Sesión inválida')
          setOpenResult(true)
          return
        }

        const { data: row, error } = await supabase
          .from('members_with_status')
          .select('*')
          .ilike('email', emailToCheck)
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error('[validate] query error', error)
          throw error
        }

        const m = (row as MemberRow) ?? null
        let ok = false
        let reason = 'No se encontró el miembro'

        if (m) {
          setMember(m)
          if (m.status === 'suspendido') { ok = false; reason = 'Membresía suspendida' }
          else if (m.status === 'vencido') { ok = false; reason = 'Cuota vencida' }
          else { ok = true; reason = 'Acceso autorizado - ¡Bienvenido!' }
        }

        // Log asíncrono
        supabase.from('access_logs').insert({
          user_id: m?.user_id ?? member?.user_id ?? null,
          result: ok ? 'autorizado' : 'denegado',
          reason,
          scanned_at: new Date().toISOString(),
          // opcional: token: site.token
        }).then(() => { }, (err) => console.error('[validate] log error', err))

        setAllowed(ok)
        setResultMsg(reason)
        setOpenResult(true)

        if (ok) {
          setTimeout(() => router.replace('/profile'), 900)
        }
      } catch (e) {
        console.error('[validate] unexpected error', e)
        setAllowed(false)
        setResultMsg('Error interno al validar')
        setOpenResult(true)
      } finally {
        processingRef.current = false
      }
    },
    [member, router, userEmail]
  )

  // ========= Callback del scanner (con debounce) =========
  const handleDecode = useCallback(
    (text: string) => {
      const now = Date.now()
      if (text === lastTextRef.current && now - lastAtRef.current < 2000) return
      lastTextRef.current = text
      lastAtRef.current = now

      setPaused(true)           // pausa “soft”
      validateAccess(text)
    },
    [validateAccess]
  )

  // ========= Reintentar cámara =========
  const retryCamera = () => {
    setCameraError(null)
    setPaused(false)
  }

  // Si llegó ?t=... por URL, validamos directamente
  useEffect(() => {
    const t = qp.get('t')
    if (t) handleDecode(`${t}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp])

  return (
    <AdminLayout active="/validate">
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden">
        {/* Decoración de fondo futurista */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-4 pt-8 pb-12 flex flex-col min-h-full items-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-widest uppercase mb-4">
              <ShieldCheck className="w-3 h-3" />
              SISTEMA DE ACCESO
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
              Validar <span className="text-blue-500">Acceso</span>
            </h1>
            <p className="text-slate-400">Escanea tu código QR para ingresar al Dojo</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="w-full relative"
          >
            {/* Contenedor del Scanner con brillo perimetral */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-[2rem] blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-slate-900 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
                <div className="p-4">
                  {cameraError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-3"
                    >
                      <XCircle className="w-5 h-5 shrink-0" />
                      {cameraError}
                    </motion.div>
                  )}

                  <div className="flex items-center justify-center gap-3 mb-4">
                    <button
                      onClick={() => setPaused(p => !p)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium text-sm ${paused
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95'
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                        }`}
                    >
                      {paused ? <Zap className="w-4 h-4 fill-current" /> : <Camera className="w-4 h-4" />}
                      {paused ? 'Reanudar' : 'Pausar'}
                    </button>
                    <button
                      onClick={retryCamera}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all font-medium text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reintentar
                    </button>
                  </div>

                  <QRScannerHtml5
                    paused={paused}
                    onDecode={handleDecode}
                    onError={(e: any) => {
                      const msg = String(e?.message || e)
                      if (
                        msg.includes('scanner is not paused') ||
                        msg.includes('scanner is not scanning') ||
                        msg.includes('NotFoundError') ||
                        msg.includes('AbortError')
                      ) return
                      console.error('[QRScannerHtml5] Camera error:', msg)
                      setCameraError('Error de cámara. Por favor reintenta.')
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Footer decorativo */}
          <div className="mt-auto pt-12 text-center opacity-40">
            <p className="text-xs text-slate-500 font-medium tracking-widest uppercase">Beleza Dojo Access Protocol v2.0</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {openResult && (
          <Dialog open={openResult} onOpenChange={(o) => {
            setOpenResult(o)
            if (!o && allowed === false) setPaused(false)
          }}>
            <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 text-white rounded-3xl overflow-hidden p-0">
              <div className="relative p-8 text-center bg-gradient-to-b from-transparent to-black/40">
                <DialogHeader><DialogTitle className="sr-only">Resultado</DialogTitle></DialogHeader>

                {allowed ? (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30 relative">
                      <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-pulse" />
                      <CheckCircle className="w-14 h-14 text-green-500 relative z-10" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">Acceso Autorizado</h2>
                    <div className="space-y-1">
                      <p className="text-xl font-bold text-slate-200">{fullName(member)}</p>
                      <p className="text-green-500 font-semibold tracking-wide">{resultMsg}</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30 relative">
                      <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 animate-pulse" />
                      <XCircle className="w-14 h-14 text-red-500 relative z-10" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">Acceso Denegado</h2>
                    <p className="text-red-400 font-medium text-lg">{resultMsg || 'No autorizado'}</p>
                    <div className="pt-6">
                      <Button
                        onClick={() => setOpenResult(false)}
                        className="w-full py-6 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 text-white font-bold"
                      >
                        REINTENTAR
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}

export default function ValidatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-600/20 rounded-full mb-4" />
          <p className="text-xs uppercase tracking-widest text-slate-500">Cargando Validacón...</p>
        </div>
      </div>
    }>
      <ValidateContent />
    </Suspense>
  )
}
