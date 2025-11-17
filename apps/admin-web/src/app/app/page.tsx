'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const go = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user

      if (!user) {
        router.replace('/login')
        return
      }

      // 🔹 Primero intentamos por user_id
      let { data: profile } = await supabase
        .from('profiles')
        .select('user_id, role, email')
        .eq('user_id', user.id)
        .maybeSingle()

      // 🔹 Si no hay perfil con ese user_id, probamos por email
      if (!profile) {
        const { data: byEmail } = await supabase
          .from('profiles')
          .select('user_id, role, email')
          .ilike('email', user.email ?? '')
          .maybeSingle()

        if (byEmail) {
          console.debug('🪄 Vinculando profile existente con nuevo user_id...')
          await supabase
            .from('profiles')
            .update({ user_id: user.id })
            .eq('email', user.email ?? '')
          profile = { ...byEmail, user_id: user.id }
        }
      }

      // 🔹 Si sigue sin encontrar, crea un perfil nuevo
      if (!profile) {
        console.debug('[page] creando nuevo perfil…')
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email ?? null,
            role: 'member',
          })
          .select()
          .single()
        profile = newProfile
      }

      // 🔹 Redirección por rol
      const role = profile?.role ?? 'member'
      if (role === 'admin') {
        router.replace('/admin')
      } else {
        router.replace('/validate')
      }
    }

    go()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-600">
      <p className="text-lg font-semibold animate-pulse">Redirigiendo...</p>
    </div>
  )
}
