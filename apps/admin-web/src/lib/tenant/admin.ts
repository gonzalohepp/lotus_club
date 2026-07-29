import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import type { DojoRole } from './types'

/**
 * admin.ts — Utilidades para las rutas que operan con SERVICE ROLE.
 *
 * ⚠️ El service role BYPASSEA RLS por completo. Toda la protección multi-tenant
 * que dan las políticas desaparece en estas rutas, así que el scoping por dojo
 * hay que hacerlo A MANO y sin excepciones.
 *
 * El agujero concreto que estas helpers cierran: `/api/members/update` y
 * `/api/members/delete` verificaban "¿sos admin de tu dojo activo?" y después
 * operaban sobre el `user_id` que viniera en el body, con service role. Un dueño
 * de Lotus Lanús podía editar el perfil —o borrar la cuenta entera, con todos
 * sus pagos en otras sedes— de cualquier persona de la plataforma, incluido el
 * platform admin, mandando su user_id a mano.
 *
 * Regla: en una ruta con service role, ningún `user_id` que venga del cliente
 * se toca sin pasarlo antes por `assertMemberOfDojo()`.
 */

export function serviceClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
    })
}

export type ServiceClient = ReturnType<typeof serviceClient>

/**
 * Verifica que `userId` pertenezca a `dojoId`. Devuelve su rol en esa sede.
 * Si no pertenece, devuelve 404 — no 403 — para no confirmarle a un dojo la
 * existencia de una persona en otro.
 */
export async function assertMemberOfDojo(
    admin: ServiceClient,
    dojoId: string,
    userId: string
): Promise<{ role: DojoRole; memberId: string } | { error: NextResponse }> {
    const { data } = await admin
        .from('dojo_members')
        .select('id, role')
        .eq('dojo_id', dojoId)
        .eq('user_id', userId)
        .maybeSingle()

    if (!data) {
        return { error: NextResponse.json({ error: 'Esa persona no pertenece a esta sede' }, { status: 404 }) }
    }

    return { role: data.role as DojoRole, memberId: data.id }
}

/**
 * El platform admin no puede ser editado ni eliminado por un dueño de sede.
 * Sin esto, un administrador de sede podría degradar o borrar la cuenta del
 * dueño de la plataforma desde su propio panel.
 */
export async function isPlatformAdmin(admin: ServiceClient, userId: string): Promise<boolean> {
    const { data } = await admin.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle()
    return !!data
}

/**
 * Impide dejar una sede sin ningún administrador.
 *
 * Los roles de sede llegan hasta `admin`; por encima está el superadmin de la
 * marca, que vive en `org_members`. Si se degrada o se da de baja al último
 * `admin` de un dojo, esa sucursal queda sin nadie que la opere en el día a día
 * y hay que subir un nivel (superadmin de la organización, o el desarrollador)
 * para volver a asignar a alguien.
 *
 * No hay chequeo de escalada de privilegios entre roles de sede porque no la
 * hay: `admin` es el techo, así que un admin creando otro admin crea un par, no
 * un superior. Ascender a nivel de marca requiere `org_members`, protegida por
 * su propia policy (`is_org_admin`).
 */
export async function isLastAdmin(admin: ServiceClient, dojoId: string, userId: string): Promise<boolean> {
    const { data: target } = await admin
        .from('dojo_members')
        .select('role')
        .eq('dojo_id', dojoId)
        .eq('user_id', userId)
        .maybeSingle()

    if (target?.role !== 'admin') return false

    const { count } = await admin
        .from('dojo_members')
        .select('id', { count: 'exact', head: true })
        .eq('dojo_id', dojoId)
        .eq('role', 'admin')
        .eq('is_active', true)

    return (count ?? 0) <= 1
}
