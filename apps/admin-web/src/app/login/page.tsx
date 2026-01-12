'use client'

import { useCallback, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-xl shadow-2xl border-none">
        <CardContent className="p-10">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 mb-6 rounded-full bg-white shadow-md flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Beleza Dojo"
                width={96}
                height={96}
                className="rounded-full"
              />
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
              Bienvenidos al portal de profesores y alumnos de  –<br /> Beleza Dojo
            </h1>
            <p className="text-slate-600 mt-2 mb-8">Ingrese para continuar</p>

            <Button
              onClick={handleLogin}
              size="lg"
              className="w-full max-w-sm bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded-lg shadow-sm flex items-center justify-center gap-3 transition-all"
            >
              <Image
                src="/google-icon.svg" // 👈 descargá o usá un ícono oficial
                alt="Google logo"
                width={20}
                height={20}
              />
              <span className="text-sm font-medium">Continuar con Google</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
