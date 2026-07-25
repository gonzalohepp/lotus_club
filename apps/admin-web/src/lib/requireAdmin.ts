import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { hasFeature, type FeatureKey } from './features'

type UserAuthResult =
  | { error: NextResponse; user?: undefined; supabase?: undefined }
  | { error?: undefined; user: User; supabase: Awaited<ReturnType<typeof getServerSupabase>> }

type AdminAuthResult =
  | { error: NextResponse; user?: undefined }
  | { error?: undefined; user: User }

async function getServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {
          // no-op: en un Route Handler no necesitamos escribir cookies
        },
        remove() {
          // no-op
        },
      },
    }
  )
}

/** Requiere que haya una sesión válida. No exige ningún rol en particular. */
export async function requireUser(): Promise<UserAuthResult> {
  const supabase = await getServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  return { user, supabase }
}

export async function requireAdmin(): Promise<AdminAuthResult> {
  const auth = await requireUser()
  if (auth.error) return { error: auth.error }

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('role')
    .eq('user_id', auth.user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }

  return { user: auth.user }
}

/**
 * Corta rutas de features que no están habilitadas en esta instancia (plan
 * Basic). Devuelve 404 en vez de 403 para no revelar que la feature existe.
 */
export function requireFeature(key: FeatureKey): { error?: NextResponse } {
  if (!hasFeature(key)) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return {}
}
