'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Lock } from 'lucide-react'

/**
 * Login por email y contraseña, para poder entrar como los usuarios que crea
 * `database/verify-tenant-isolation.py` — cuentas de prueba que no tienen
 * Google detrás y por lo tanto no pueden usar el OAuth.
 *
 * Se habilita solo en desarrollo, o con NEXT_PUBLIC_ENABLE_EMAIL_LOGIN=on. En
 * producción no aparece: el acceso de los alumnos es con Google, y un formulario
 * de contraseña visible invita a intentos de fuerza bruta sobre cuentas reales.
 */
const EMAIL_LOGIN_ENABLED =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_EMAIL_LOGIN === 'on'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Si ya está logueado, redirigir directo
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (!user) return

      router.replace('/app')
    }

    checkSession()
  }, [router])

  const handleLogin = useCallback(async () => {
    setLoading(true)
    const base =
      (typeof window !== 'undefined' ? window.location.origin : '') ||
      process.env.NEXT_PUBLIC_SITE_URL;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${base}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        },
      },
    })
  }, [])

  const handleEmailLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setEmailError(null)
      setEmailLoading(true)

      const { error } = await supabase.auth.signInWithPassword({ email, password })

      setEmailLoading(false)

      if (error) {
        setEmailError(
          error.message === 'Invalid login credentials'
            ? 'Email o contraseña incorrectos'
            : error.message
        )
        return
      }

      // Recarga completa en vez de router.push: el tenant se resuelve en el
      // layout del servidor, que necesita la cookie de sesión recién escrita.
      window.location.href = '/app'
    },
    [email, password]
  )

  /** Los cuatro pilares de la arquitectura conceptual del manual de marca. */
  const PILARES = ['Conducción', 'Gestión', 'Comunidad', 'Legado']

  return (
    /* Base Onyx con acento orgánico, según la dirección visual de Kuro. Sin
       glows ni degradados de color: el manual descarta explícitamente la
       estética de "software genérico". La estructura la dan las reglas finas. */
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#121113] font-sans selection:bg-[#899878]/30">

      {/* Sala de tatami del manual de marca. Encuadrada abajo por dos razones:
          es la parte de piso y shoji —el "tatami" propiamente dicho— y evita el
          logo que viene incrustado en el centro del arte, que competiría con el
          wordmark de al lado. */}
      <Image
        src="/kuro-dojo.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover object-bottom"
      />
      {/* Velo base: deja ver la madera pero baja el contraste de la foto. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#121113]/55" />
      {/* Y una caída hacia la izquierda, que es donde va el texto claro. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#121113] via-[#121113]/75 to-transparent"
      />

      {/* Retícula tenue por encima: mantiene la lectura estructurada del manual. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#F7F7F2 1px, transparent 1px), linear-gradient(90deg, #F7F7F2 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center justify-between gap-14 p-6 md:flex-row md:gap-10 md:p-12">

        {/* ==================== Marca ==================== */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="flex-1 space-y-9 text-center md:text-left"
        >
          <Image
            src="/kuro-wordmark.png"
            alt="Kuro"
            width={354}
            height={169}
            priority
            className="mx-auto h-16 w-auto md:mx-0 md:h-20"
          />

          <div className="space-y-5">
            <div className="mx-auto h-px w-16 bg-[#899878] md:mx-0" />
            {/* El login es la puerta de todas las organizaciones de la
                plataforma y todavía no hay sesión de la cual deducir cuál. La
                marca de acá es Kuro; el nombre de la academia aparece adentro. */}
            <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-[#F7F7F2] md:text-5xl">
              Tecnología con<br />
              <span className="text-[#899878]">raíz de tatami</span>
            </h1>
            <p className="mx-auto max-w-md text-base leading-relaxed text-[#A7ACA2] md:mx-0">
              La plataforma nacida desde la lógica real del jiu-jitsu. Entrá para ver tus clases,
              tu cuota y tu credencial de acceso.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 md:justify-start">
            {PILARES.map((p) => (
              <span
                key={p}
                className="rounded-full border border-[#899878]/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#E4E6C3]"
              >
                {p}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ==================== Acceso ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="w-full max-w-md"
        >
          <div className="rounded-[28px] border border-[#899878]/25 bg-[#222725] p-8 shadow-2xl shadow-black/40 md:p-10">

            {/* El badge trae su propio cuadro Carbon Black, que sobre una tarjeta
                del mismo tono desaparece. El anillo Palm Leaf lo delimita. */}
            <div className="mb-8 flex justify-center">
              <Image
                src="/kuro-icon.png"
                alt=""
                width={284}
                height={284}
                className="h-20 w-20 rounded-2xl ring-1 ring-[#899878]/30"
              />
            </div>

            <div className="mb-8 text-center">
              <h2 className="mb-2 text-2xl font-bold text-[#F7F7F2]">Bienvenido de nuevo</h2>
              <p className="text-sm text-[#A7ACA2]">Ingresá con tu cuenta verificada</p>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-[#F7F7F2] px-6 py-4 text-base font-bold text-[#121113] transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#5B5F58]" />
              ) : (
                <>
                  <Image src="/google-icon.svg" width={20} height={20} alt="" />
                  <span>Continuar con Google</span>
                  <ArrowRight className="h-4 w-4 text-[#5B5F58] transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>

            {EMAIL_LOGIN_ENABLED && (
              <div className="mt-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#F7F7F2]/10" />
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#A7ACA2]">
                    <Lock className="h-3 w-3" />
                    Acceso de prueba
                  </span>
                  <div className="h-px flex-1 bg-[#F7F7F2]/10" />
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email"
                    autoComplete="username"
                    className="h-11 w-full rounded-xl border border-[#F7F7F2]/15 bg-[#F7F7F2]/5 px-4 text-sm text-[#F7F7F2] outline-none transition-colors placeholder:text-[#A7ACA2]/60 focus:border-[#899878]"
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="contraseña"
                    autoComplete="current-password"
                    className="h-11 w-full rounded-xl border border-[#F7F7F2]/15 bg-[#F7F7F2]/5 px-4 text-sm text-[#F7F7F2] outline-none transition-colors placeholder:text-[#A7ACA2]/60 focus:border-[#899878]"
                  />

                  {emailError && (
                    /* Alert Red del manual, aclarado: el original da 2.79:1
                       sobre Carbon Black y no se lee. */
                    <p className="text-xs font-medium text-[#E4685A]">{emailError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#899878]/40 bg-[#899878]/15 text-sm font-bold text-[#E4E6C3] transition-colors hover:bg-[#899878]/25 disabled:opacity-50"
                  >
                    {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ingresar'}
                  </button>
                </form>

                {/* El texto anterior era una nota para nosotros ("Solo visible
                    en desarrollo") y quedó a la vista de los clientes que están
                    probando la app: los dejaba usando un modo que el propio
                    cartel llamaba de desarrollo. Dice lo mismo, contado desde el
                    lado de quien prueba. */}
                <p className="mt-3 text-center text-[10px] text-[#A7ACA2]/70">
                  Acceso con las cuentas de la prueba. Los alumnos entran con Google.
                </p>
              </div>
            )}

            <p className="mt-8 text-center text-xs text-[#A7ACA2]">
              ¿Problemas para ingresar?{' '}
              <a href="#" className="font-semibold text-[#899878] transition-colors hover:text-[#A8B599]">
                Contactá soporte
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
