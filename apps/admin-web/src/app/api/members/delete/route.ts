import { NextResponse } from 'next/server'

import { requireDojoManager } from '@/lib/tenant/server'
import { assertMemberOfDojo, isLastAdmin, isPlatformAdmin, serviceClient } from '@/lib/tenant/admin'

/**
 * Baja de un alumno DE LA SEDE ACTIVA.
 *
 * ⚠️ Cambio de semántica respecto de la versión single-tenant. Antes esta ruta
 * borraba, con service role y sin ningún chequeo de pertenencia:
 *
 *     class_enrollments, memberships, payments, access_logs, qr_tokens
 *     → todos por user_id, en TODA la base
 *     + profiles
 *     + auth.admin.deleteUser()
 *
 * En multi-tenant eso significaba que el dueño de Lotus Lanús podía borrar a un
 * alumno que además entrena en Avellaneda y llevarse puestos los pagos y la
 * membresía de la otra sede, más la cuenta entera de la persona. Y podía
 * hacerlo con CUALQUIER user_id, incluido el del platform admin.
 *
 * Ahora la baja es por sede:
 *   · Se borran sólo los datos de ESE dojo.
 *   · Se quita la fila de `dojo_members`.
 *   · El perfil y la cuenta de auth sobreviven mientras la persona pertenezca a
 *     alguna otra sede.
 *   · El borrado definitivo (perfil + auth) queda reservado al platform admin,
 *     y sólo cuando ya no queda ninguna pertenencia.
 */
export async function POST(req: Request) {
  const guard = await requireDojoManager()
  if (guard.error) return guard.error

  const { dojoId, ctx } = guard

  try {
    const { user_id } = (await req.json()) ?? {}

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Delete API] SUPABASE_SERVICE_ROLE_KEY is missing')
      return NextResponse.json(
        { error: 'Configuración incompleta: SUPABASE_SERVICE_ROLE_KEY no encontrada en el servidor.' },
        { status: 500 }
      )
    }

    const admin = serviceClient()

    const target = await assertMemberOfDojo(admin, dojoId, user_id)
    if ('error' in target) return target.error

    if (await isPlatformAdmin(admin, user_id)) {
      return NextResponse.json(
        { error: 'No podés eliminar a un administrador de la plataforma' },
        { status: 403 }
      )
    }

    if (await isLastAdmin(admin, dojoId, user_id)) {
      return NextResponse.json(
        { error: 'Es el único administrador de la sede. Asigná otro antes de darlo de baja.' },
        { status: 409 }
      )
    }

    // Datos de ESTA sede únicamente. El `.eq('dojo_id', dojoId)` de cada línea
    // es lo que impide pisar la otra sede del alumno.
    await admin.from('class_enrollments').delete().eq('dojo_id', dojoId).eq('user_id', user_id)
    await admin.from('memberships').delete().eq('dojo_id', dojoId).eq('member_id', user_id)
    await admin.from('payments').delete().eq('dojo_id', dojoId).eq('user_id', user_id)
    await admin.from('access_logs').delete().eq('dojo_id', dojoId).eq('user_id', user_id)

    const { error: memberError } = await admin
      .from('dojo_members')
      .delete()
      .eq('dojo_id', dojoId)
      .eq('user_id', user_id)

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 400 })
    }

    // ¿Le queda alguna otra sede? Si sí, la persona sigue existiendo.
    const { count: remaining } = await admin
      .from('dojo_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)

    if ((remaining ?? 0) > 0) {
      return NextResponse.json({ ok: true, scope: 'dojo', remainingDojos: remaining })
    }

    // Sin sedes. Borrar el perfil y la cuenta es irreversible y afecta al login
    // de esa persona en toda la plataforma, así que lo reservamos al dueño de la
    // plataforma. Para un admin de sede, la baja termina acá.
    if (!ctx.isPlatformAdmin) {
      return NextResponse.json({ ok: true, scope: 'dojo', remainingDojos: 0 })
    }

    await admin.from('profiles').delete().eq('user_id', user_id)

    const { error: authError } = await admin.auth.admin.deleteUser(user_id)
    if (authError) {
      console.warn('[Delete API] Auth user deletion failed or user not found:', authError.message)
    }

    return NextResponse.json({ ok: true, scope: 'platform' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
