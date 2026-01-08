import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
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

    profile = byEmail
  }

  // 🔹 Redirección por rol
  const role = profile?.role ?? 'member'
  if (role === 'admin') {
    redirect('/admin')
  } else {
    // Si no tiene perfil o no es admin, va a validate
    redirect('/validate')
  }

  return null
}
