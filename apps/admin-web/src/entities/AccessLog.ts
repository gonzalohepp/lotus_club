// src/entities/AccessLog.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type AccessLogRow = {
  id: number
  user_id: string
  member_name: string | null
  email: string | null
  access_time: string // ISO
  status: 'autorizado' | 'denegado' | string
  reason: string | null
}

export const AccessLog = {
  async list(order: 'access_time' | '-access_time' = '-access_time'): Promise<AccessLogRow[]> {
    const ascending = order !== '-access_time'
    const { data, error } = await supabase
      .from('access_logs_view')
      .select('*')
      .order('access_time', { ascending })

    if (error) {
      // Log entendible (a veces viene {} si no tenés permiso)
      const pgError = error as { message?: string; details?: string; hint?: string; code?: string }
      console.error('[AccessLog.list] supabase error:', {
        message: pgError.message,
        details: pgError.details,
        hint: pgError.hint,
        code: pgError.code
      })
      return []
    }
    return (data ?? []) as AccessLogRow[]
  },
}
