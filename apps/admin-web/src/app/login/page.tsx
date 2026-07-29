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

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-950 font-sans selection:bg-blue-500/30">

      {/* Background Ambience / Image */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Fondo neutro: la imagen anterior era de Beleza. El degradado solo
            alcanza para dar profundidad sin atarse a ninguna marca. */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-black" />
      </div>

      <div className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-between p-6 md:p-12 relative z-10 gap-12 md:gap-0">

        {/* Left Side: Brand & Copy */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex-1 text-center md:text-left space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-blue-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Portal de Miembros
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[1.1]">
              Beleza <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Dojo</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-lg mx-auto md:mx-0 font-medium leading-relaxed">
              Gestiona tu entrenamiento, revisa tus clases y accede al dojo con tu credencial digital.
            </p>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-4 pt-4">
            <div className="flex -space-x-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center text-xs text-white overflow-hidden">
                  <div className={`w-full h-full bg-gradient-to-br ${['from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600', 'from-orange-500 to-red-600', 'from-purple-500 to-pink-600'][i]}`} />
                </div>
              ))}
            </div>
            <div className="text-sm text-slate-500 font-medium">
              <span className="text-white font-bold">150+</span> Alumnos entrenando hoy
            </div>
          </div>
        </motion.div>

        {/* Right Side: Glass Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000" />

            <div className="relative bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[30px] p-8 md:p-10 shadow-2xl">

              <div className="flex justify-center mb-8">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse" />
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={96}
                    height={96}
                    className="relative z-10 w-full h-full object-contain drop-shadow-2xl"
                  />
                </div>
              </div>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Bienvenido de nuevo</h2>
                <p className="text-slate-400 text-sm">
                  Inicia sesión con tu cuenta verificada
                </p>
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full group relative flex items-center justify-center gap-3 bg-white text-slate-900 py-4 px-6 rounded-2xl font-bold text-base hover:bg-slate-50 hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : (
                  <>
                    <Image src="/google-icon.svg" width={20} height={20} alt="Google" />
                    <span>Continuar con Google</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {EMAIL_LOGIN_ENABLED && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <Lock className="w-3 h-3" />
                      Acceso de prueba
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <form onSubmit={handleEmailLogin} className="space-y-3">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email"
                      autoComplete="username"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="contraseña"
                      autoComplete="current-password"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 transition-colors"
                    />

                    {emailError && (
                      <p className="text-xs text-rose-400 font-medium">{emailError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-bold text-white transition-colors disabled:opacity-50"
                    >
                      {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ingresar'}
                    </button>
                  </form>

                  <p className="mt-3 text-[10px] text-slate-600 text-center">
                    Solo visible en desarrollo. Los alumnos entran con Google.
                  </p>
                </div>
              )}

              <div className="mt-8 text-center space-y-4">
                <p className="text-xs text-slate-500">
                  ¿Problemas para ingresar? <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Contacta soporte</a>
                </p>
              </div>

              {/* Decorative bottom line */}
              <div className="absolute bottom-0 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  )
}
