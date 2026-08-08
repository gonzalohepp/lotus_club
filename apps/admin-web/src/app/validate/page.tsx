'use client'

import { useCallback, useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle, XCircle, RefreshCw, Camera, ShieldCheck, Zap } from 'lucide-react'
import QRScannerHtml5 from '@/components/QRScannerHtml5'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { MemberRow as BaseMemberRow } from '@/types/member'
import { evaluateBilling } from '@/lib/billing'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'

export const dynamic = 'force-dynamic'

type MemberRow = BaseMemberRow & {
  is_new_member?: boolean
}

// ClassCandidate ahora incluye campos de precio e is_principal
type ClassCandidate = {
  id: number
  name: string
  instructor: string | null
  start_time: string | null
  end_time: string | null
  color: string | null
  days: string[] | null
  is_principal?: boolean
  price_principal?: number | null
  price_additional?: number | null
}

/**
 * Calcula el precio mensual total desde las clases inscriptas.
 * Retorna null si no hay información de precios disponible.
 */
function calcPriceFromClasses(classes: ClassCandidate[]): number | null {
  if (classes.length === 0) return null
  let total = 0
  let hasPriceInfo = false

  for (const cl of classes) {
    const price = cl.is_principal
      ? (cl.price_principal ?? null)
      : (cl.price_additional ?? cl.price_principal ?? null)

    if (price !== null && price !== undefined) {
      total += price
      hasPriceInfo = true
    }
  }

  return hasPriceInfo ? total : null
}

const fullName = (m: MemberRow | null) =>
  m ? [m.first_name ?? '', m.last_name ?? ''].join(' ').trim() || 'Miembro' : 'Miembro'

function ValidateContent() {
  const { mercadoPago, activeDojo } = useTenant()
  // El ingreso se valida y se registra CONTRA UNA SEDE: el mismo alumno puede
  // estar al día en Lanús y bloqueado en Quilmes.
  const dojoId = activeDojo?.id
  const router = useRouter()
  const qp = useSearchParams()

  const [member, _setMember] = useState<MemberRow | null>(null)
  const memberRef = useRef<MemberRow | null>(null)
  const setMember = (m: MemberRow | null) => {
    memberRef.current = m
    _setMember(m)
  }

  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Recargo por mora según las reglas de ESTA sede.
  const multiplier = useMemo(() =>
    evaluateBilling(activeDojo?.billing, {
      endDate: member?.next_payment_due,
      isNewMember: member?.is_new_member ?? false,
      role: member?.role,
      timezone: activeDojo?.timezone,
    }).multiplier,
    [member?.next_payment_due, member?.is_new_member, member?.role, activeDojo?.billing, activeDojo?.timezone]
  )

  // Todas las clases inscriptas del miembro (con precios) — se cargan en el denied flow
  const [allEnrolledClasses, setAllEnrolledClasses] = useState<ClassCandidate[]>([])

  const [paused, setPaused] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const [openResult, setOpenResult] = useState(false)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [resultMsg, setResultMsg] = useState('')

  const [candidateClasses, setCandidateClasses] = useState<ClassCandidate[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<Set<number>>(new Set())
  const [showClassSelection, setShowClassSelection] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)

  const processingRef = useRef(false)
  const lastTextRef = useRef<string | null>(null)
  const lastAtRef = useRef<number>(0)

  // ========= Sesión y preload del miembro =========
  useEffect(() => {
    ; (async () => {
      const { data } = await supabase.auth.getUser()
      const email = data.user?.email ?? null
      setUserEmail(email)
      if (!email) {
        router.replace('/login')
        return
      }
      // Sin sede activa todavía no hay a quién buscar: el tenant baja del
      // layout server-side y llega un tick después del primer render.
      if (!dojoId) return

      const { data: rows, error } = await supabase
        .from('members_with_status')
        .select('*')
        .eq('dojo_id', dojoId)
        .ilike('email', email)
        .limit(1)

      if (error) console.error('[validate] preload error', error)
      setMember((rows?.[0] as MemberRow) ?? null)
    })()
  }, [router, dojoId])

  // ========= Cargar TODAS las clases con precios (para flujo de pago) =========
  const loadEnrolledClassesWithPrices = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('class_enrollments')
      .select(`
        is_principal,
        classes:class_id (
          id, name, instructor, start_time, end_time, color, days,
          price_principal, price_additional
        )
      `)
      .eq('dojo_id', dojoId ?? NO_DOJO)
      .eq('user_id', userId)

    if (error) {
      console.error('[validate] error fetching enrolled classes with prices', error)
      return []
    }

    return (data ?? [])
      .filter((e) => e.classes)
      .map((e) => {
        const cl = e.classes as unknown as ClassCandidate
        return { ...cl, is_principal: e.is_principal }
      })
  }, [dojoId])

  // ========= Confirmar el ingreso =========
  /**
   * Registra el ingreso llamando a `/api/access/checkin`.
   *
   * Ya no escribe `access_logs` ni `class_attendance` desde el navegador: el
   * alumno perdió el INSERT directo sobre esas tablas a propósito. Si la
   * decisión de "autorizado" la tomara el cliente, cualquiera podría marcarse
   * presente desde la consola sin escanear y con la cuota vencida.
   *
   * El servidor vuelve a verificar cuota, sede e inscripción antes de escribir.
   */
  const finalizeAccess = useCallback(
    async (m: MemberRow, success: boolean, reason: string, selectedIds: number[] = []) => {
      setIsFinalizing(true)
      try {
        // El rechazo ya quedó registrado por /api/access/validate; acá sólo se
        // muestra. Confirmar sólo tiene sentido en el camino autorizado.
        if (success) {
          const res = await fetch('/api/access/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ class_ids: selectedIds }),
          })
          const json = await res.json().catch(() => ({}))

          if (!res.ok || json.allowed === false) {
            setAllowed(false)
            setResultMsg(json.reason ?? json.error ?? 'No se pudo registrar el ingreso')
            setOpenResult(true)
            return
          }
        }

        setAllowed(success)
        setResultMsg(reason)
        setOpenResult(true)

        if (success) {
          setTimeout(() => router.replace('/profile'), 1500)
        }
      } catch (e) {
        console.error('[validate] finalize error', e)
        setAllowed(false)
        setResultMsg('No se pudo conectar con el servidor')
        setOpenResult(true)
      } finally {
        setIsFinalizing(false)
        setShowClassSelection(false)
      }
    },
    [router]
  )

  // ========= Redirigir a Mercado Pago =========
  const redirectToMP = useCallback(
    async (m: MemberRow, selectedIds: number[]) => {
      if (!mercadoPago) {
        toast.error('El pago online no está disponible', {
          description: 'Acercate a recepción para regularizar tu cuota.',
        })
        return
      }
      setIsFinalizing(true)
      try {
        // Usar clases completas con precios para calcular el monto
        let enrolled = allEnrolledClasses
        if (enrolled.length === 0) {
          enrolled = await loadEnrolledClassesWithPrices(m.user_id)
          setAllEnrolledClasses(enrolled)
        }

        // Calcular precio desde clases reales
        const basePrice =
          calcPriceFromClasses(enrolled) ??  // 1er opción: suma de precios de clases
          m.estimated_monthly_fee ??          // 2do: campo precalculado en la view
          null                                // 3ro: sin dato → error

        if (basePrice === null || basePrice === 0) {
          toast.error('No se pudo determinar el precio de la cuota', {
            description: 'Contactá a recepción para regularizar tu situación.',
          })
          setIsFinalizing(false)
          return
        }

        const finalPrice = Math.round(basePrice * multiplier)

        const res = await fetch('/api/payments/mp/preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              {
                id: 'cuota_mensual',
                // El recargo sale del motor de cobro de la sede, no de un 20% fijo.
                title: `Cuota Mensual - ${activeDojo?.name ?? 'Dojo'}${multiplier > 1 ? ` (Recargo ${Math.round((multiplier - 1) * 100)}%)` : ''}`,
                price: finalPrice,
              },
            ],
            payer_email: m.email || userEmail,
            user_id: m.user_id,
            principal_id: enrolled.find((c) => c.is_principal)?.id,
            additional_ids: selectedIds,
          }),
        })

        const data = await res.json()

        if (data.init_point) {
          window.location.href = data.init_point
        } else if (data.sandbox_init_point) {
          window.location.href = data.sandbox_init_point
        } else {
          throw new Error('No se recibió link de pago')
        }
      } catch (e) {
        console.error('[validate] payment error', e)
        toast.error('Error al generar el pago', {
          description: 'Intentá de nuevo o contactá a recepción.',
        })
      } finally {
        setIsFinalizing(false)
      }
    },
    [allEnrolledClasses, loadEnrolledClassesWithPrices, multiplier, userEmail]
  )

  // ========= Validación principal =========
  const validateAccess = useCallback(
    async (rawText: string) => {
      if (processingRef.current) return
      processingRef.current = true

      try {
        // 1) Validar token QR
        let token = ''
        try {
          const u = new URL(rawText)
          token = u.searchParams.get('t') || ''
        } catch { }

        if (!token) {
          setAllowed(false)
          setResultMsg('QR inválido (Sin token)')
          setOpenResult(true)
          return
        }

        // Toda la validación —token, sede, cuota, cooldown y clases del día—
        // se resuelve en el servidor. Antes vivía acá, en el navegador del
        // alumno, que es exactamente quien no debería decidir si puede entrar.
        const res = await fetch('/api/access/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          setAllowed(false)
          setResultMsg(data.error ?? 'No se pudo validar el acceso')
          setOpenResult(true)
          return
        }

        if (data.member) setMember(data.member as MemberRow)

        if (!data.allowed) {
          // El rechazo ya quedó registrado del lado del servidor.
          setAllowed(false)
          setResultMsg(data.reason ?? 'Acceso denegado')
          setOpenResult(true)

          // Con la cuota vencida se ofrece regularizar en el momento.
          if (!data.alreadyIn && data.member) {
            const clases = await loadEnrolledClassesWithPrices(data.member.user_id)
            setAllEnrolledClasses(clases)
          }
          return
        }

        // Autorizado sin clases inscritas: el servidor ya registró el ingreso.
        if (data.checkedIn) {
          setAllowed(true)
          setResultMsg(data.reason ?? '¡Bienvenido!')
          setOpenResult(true)
          setTimeout(() => router.replace('/profile'), 1500)
          return
        }

        // Autorizado con clases: falta que elija a cuál viene.
        setCandidateClasses(data.classes ?? [])
        setSelectedClassIds(new Set())
        setShowClassSelection(true)
      } catch (e) {
        console.error('[validate] unexpected error', e)
        setAllowed(false)
        setResultMsg('Error interno al validar')
        setOpenResult(true)
      } finally {
        processingRef.current = false
      }
    },
    [userEmail, finalizeAccess]
  )

  // ========= Callback del scanner (con debounce) =========
  const handleDecode = useCallback(
    (text: string) => {
      const now = Date.now()
      if (text === lastTextRef.current && now - lastAtRef.current < 10000) return
      lastTextRef.current = text
      lastAtRef.current = now
      setPaused(true)
      validateAccess(text)
    },
    [validateAccess]
  )

  const retryCamera = () => {
    setCameraError(null)
    setPaused(false)
  }

  useEffect(() => {
    const t = qp.get('t')
    if (t) handleDecode(`${t}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp])

  return (
    <AdminLayout active="/validate">
      <div className="relative min-h-[calc(100vh-4rem)] bg-background overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-kuro-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-kuro-600 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-4 pt-8 pb-12 flex flex-col min-h-full items-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kuro-500/10 border border-kuro-500/20 text-kuro-400 text-xs font-bold tracking-widest uppercase mb-4">
              <ShieldCheck className="w-3 h-3" />
              SISTEMA DE ACCESO
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
              Validar <span className="text-kuro-600 dark:text-kuro-400">Acceso</span>
            </h1>
            <p className="text-carbon-500 dark:text-carbon-400">Escanea tu código QR para ingresar al Dojo</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="w-full relative"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-kuro-500 to-kuro-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
              <div className="relative bg-white dark:bg-white/5 rounded-2xl overflow-hidden border border-carbon-200 dark:border-white/10 shadow-sm">
                <div className="p-4">
                  {cameraError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-4 rounded-xl border border-alert-500/20 bg-alert-500/10 p-4 text-sm text-alert-400 flex items-center gap-3"
                    >
                      <XCircle className="w-5 h-5 shrink-0" />
                      {cameraError}
                    </motion.div>
                  )}

                  <div className="flex items-center justify-center gap-3 mb-4">
                    <button
                      onClick={() => setPaused((p) => !p)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium text-sm ${paused
                        ? 'bg-kuro-600 border-kuro-500 text-white shadow-lg shadow-kuro-500/20 active:scale-95'
                        : 'bg-carbon-50 dark:bg-white/5 border-carbon-200 dark:border-white/10 text-carbon-900 dark:text-white hover:bg-carbon-100 dark:hover:bg-white/10'
                        }`}
                    >
                      {paused ? <Zap className="w-4 h-4 fill-current" /> : <Camera className="w-4 h-4" />}
                      {paused ? 'Reanudar' : 'Pausar'}
                    </button>
                    <button
                      onClick={retryCamera}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-50 dark:bg-white/5 border border-carbon-200 dark:border-white/10 text-carbon-900 dark:text-white hover:bg-carbon-100 dark:hover:bg-white/10 transition-all font-medium text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reintentar
                    </button>
                  </div>

                  <QRScannerHtml5
                    paused={paused}
                    onDecode={handleDecode}
                    onError={(e: unknown) => {
                      const msg = String(e instanceof Error ? e.message : e)
                      if (
                        msg.includes('scanner is not paused') ||
                        msg.includes('scanner is not scanning') ||
                        msg.includes('NotFoundError') ||
                        msg.includes('AbortError')
                      )
                        return
                      console.error('[QRScannerHtml5] Camera error:', msg)
                      setCameraError('Error de cámara. Por favor reintenta.')
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mt-auto pt-12 text-center opacity-40">
            <p className="text-xs text-carbon-500 dark:text-carbon-400 font-medium tracking-widest uppercase">{activeDojo?.name ?? 'Dojo'}</p>
          </div>
        </div>
      </div>

      {/* ===== Dialog: Selección de clases ===== */}
      <AnimatePresence>
        {showClassSelection && (
          <Dialog
            open={showClassSelection}
            onOpenChange={(o) => {
              if (!o) {
                setShowClassSelection(false)
                setPaused(false)
              }
            }}
          >
            <DialogContent className="sm:max-w-md bg-white dark:bg-carbon-900 border-carbon-200 dark:border-white/10 text-carbon-900 dark:text-white rounded-3xl overflow-hidden p-0">
              <div className="relative p-8">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-carbon-900 dark:text-white uppercase tracking-tight mb-2">
                    ¿A qué clase vas a ingresar?
                  </DialogTitle>
                </DialogHeader>

                <p className="text-carbon-500 dark:text-carbon-400 text-sm font-medium mb-6">
                  {member?.status !== 'activo'
                    ? 'Seleccioná las clases que querés pagar para regularizar tu acceso.'
                    : 'Hemos detectado estas clases para ti hoy:'}
                </p>

                <div className="space-y-3 mb-8">
                  {candidateClasses.map((cl) => {
                    const isSelected = selectedClassIds.has(cl.id)
                    return (
                      <button
                        key={cl.id}
                        onClick={() => {
                          const next = new Set(selectedClassIds)
                          if (next.has(cl.id)) next.delete(cl.id)
                          else next.add(cl.id)
                          setSelectedClassIds(next)
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelected
                          ? 'bg-kuro-600 border-kuro-400 shadow-lg shadow-kuro-500/20'
                          : 'bg-carbon-50 dark:bg-white/5 border-carbon-200 dark:border-white/10 hover:bg-carbon-100 dark:hover:bg-white/10'
                          }`}
                      >
                        <div className="text-left">
                          <p className="font-bold text-carbon-900 dark:text-white uppercase tracking-tight">{cl.name}</p>
                          <p
                            className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isSelected ? 'text-kuro-100' : 'text-carbon-500 dark:text-carbon-400'
                              }`}
                          >
                            {cl.start_time?.slice(0, 5)} - {cl.end_time?.slice(0, 5)}
                            {cl.instructor && ` • ${cl.instructor}`}
                          </p>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white text-kuro-600' : 'border-white/20'
                            }`}
                        >
                          {isSelected && <CheckCircle className="w-4 h-4" />}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <Button
                  onClick={async () => {
                    if (!member) return

                    if (member.status !== 'activo') {
                      // Flujo de pago: redirigir a MP con precio calculado correctamente
                      await redirectToMP(member, Array.from(selectedClassIds))
                    } else {
                      // Flujo normal: registrar ingreso
                      await finalizeAccess(
                        member,
                        true,
                        'Acceso autorizado - ¡Bienvenido!',
                        Array.from(selectedClassIds)
                      )
                    }
                  }}
                  disabled={isFinalizing || selectedClassIds.size === 0}
                  className="w-full py-6 rounded-2xl bg-kuro-600 hover:bg-kuro-500 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-kuro-500/30 transition-all disabled:opacity-50"
                >
                  {isFinalizing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : member?.status !== 'activo' ? (
                    'PAGAR Y ENTRAR'
                  ) : (
                    'CONFIRMAR INGRESO'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* ===== Dialog: Resultado ===== */}
      <AnimatePresence>
        {openResult && (
          <Dialog
            open={openResult}
            onOpenChange={(o) => {
              setOpenResult(o)
              // El scanner solo se reanuda desde el botón Reintentar
            }}
          >
            <DialogContent className="sm:max-w-md bg-white dark:bg-carbon-900 border-carbon-200 dark:border-white/10 text-carbon-900 dark:text-white rounded-3xl overflow-hidden p-0">
              <div className="relative p-8 text-center bg-gradient-to-b from-transparent to-black/40">
                <DialogHeader>
                  <DialogTitle className="sr-only">Resultado</DialogTitle>
                </DialogHeader>

                {allowed ? (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-kuro-500/20 flex items-center justify-center border border-kuro-500/30 relative">
                      <div className="absolute inset-0 bg-kuro-500 blur-2xl opacity-20 animate-pulse" />
                      <CheckCircle className="w-14 h-14 text-kuro-500 relative z-10" />
                    </div>
                    <h2 className="text-3xl font-black text-carbon-900 dark:text-white tracking-tight uppercase">
                      Acceso Autorizado
                    </h2>
                    <div className="space-y-1">
                      <p className="text-xl font-bold text-carbon-200">{fullName(member)}</p>
                      <p className="text-kuro-500 font-semibold tracking-wide">{resultMsg}</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-alert-500/20 flex items-center justify-center border border-alert-500/30 relative">
                      <div className="absolute inset-0 bg-alert-500 blur-2xl opacity-20 animate-pulse" />
                      <XCircle className="w-14 h-14 text-alert-500 relative z-10" />
                    </div>
                    <h2 className="text-3xl font-black text-carbon-900 dark:text-white tracking-tight uppercase">
                      Acceso Denegado
                    </h2>
                    <p className="text-alert-400 font-medium text-lg">{resultMsg || 'No autorizado'}</p>

                    <div className="pt-6 flex flex-col gap-3">
                      {/* Botón MP oculto por ahora */}
                      {/* {(member?.status === 'vencido' ||
                        member?.status === 'inactivo' ||
                        resultMsg.includes('vencida') ||
                        resultMsg.includes('inactive')) && (
                          <button
                            onClick={async () => {
                              setOpenResult(false)

                              // Cargar clases con precios si no están cargadas aún
                              if (member && allEnrolledClasses.length === 0) {
                                const enrolled = await loadEnrolledClassesWithPrices(member.user_id)
                                setAllEnrolledClasses(enrolled)
                                setCandidateClasses(enrolled)
                                setSelectedClassIds(new Set(enrolled.map((c) => c.id)))
                              } else if (candidateClasses.length === 0) {
                                setCandidateClasses(allEnrolledClasses)
                                setSelectedClassIds(new Set(allEnrolledClasses.map((c) => c.id)))
                              }

                              setShowClassSelection(true)
                            }}
                            className="w-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 border-none bg-[#009EE3] p-0 rounded-2xl overflow-hidden shadow-lg shadow-kuro-500/20"
                          >
                            <div className="relative h-16 w-full">
                              <Image
                                src="/mp_button.png"
                                alt="Pagar con Mercado Pago"
                                fill
                                className="object-contain"
                              />
                            </div>
                          </button>
                        )} */}

                      <Button
                        onClick={() => {
                          lastAtRef.current = 0
                          lastTextRef.current = null
                          setOpenResult(false)
                          setPaused(false)
                        }}
                        className="w-full py-6 rounded-2xl bg-carbon-100 dark:bg-white/10 border border-carbon-200 dark:border-white/10 hover:bg-carbon-200 dark:hover:bg-white/20 text-carbon-900 dark:text-white font-bold"
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-kuro-600/20 rounded-full mb-4" />
            <p className="text-xs uppercase tracking-widest text-carbon-500 dark:text-carbon-400">Cargando Validación...</p>
          </div>
        </div>
      }
    >
      <ValidateContent />
    </Suspense>
  )
}