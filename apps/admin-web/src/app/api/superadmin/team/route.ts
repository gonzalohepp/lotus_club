import { NextResponse } from 'next/server'

import { getServerSupabase, requireDojoManager } from '@/lib/tenant/server'
import type { DojoRole } from '@/lib/tenant/types'

/**
 * /api/superadmin/team — Equipo de una sede.
 *
 * Permite dar de alta dueños, administradores y profesores de un dojo sin tocar
 * SQL. Dos caminos según si la persona ya existe:
 *
 *   * Ya tiene cuenta  → se le crea la fila en `dojo_members` al instante.
 *   * Todavía no entró → queda una invitación pendiente por email, que el
 *     trigger `handle_new_user()` consume la primera vez que entra con Google.
 *
 * Autorización: `requireDojoManager(dojoId)` — administrador de la sede,
 * superadmin de la marca, o el desarrollador.
 *
 * `admin` es el techo de los roles de sede, así que no hay escalada posible
 * entre ellos: un admin que nombra a otro admin crea un par. Subir a nivel de
 * marca requiere `org_members`, que tiene su propia policy (`is_org_admin`).
 */

const VALID_ROLES: DojoRole[] = ['admin', 'instructor', 'member', 'becado']

function normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const email = value.trim().toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

/** GET ?dojo_id=... → miembros actuales + invitaciones pendientes */
export async function GET(req: Request) {
    const dojoId = new URL(req.url).searchParams.get('dojo_id')
    if (!dojoId) return NextResponse.json({ error: 'Falta dojo_id' }, { status: 400 })

    const guard = await requireDojoManager(dojoId)
    if (guard.error) return guard.error

    const supabase = await getServerSupabase()

    const [{ data: members }, { data: invitations }] = await Promise.all([
        supabase
            .from('dojo_members')
            .select('id, user_id, role, is_active, joined_at, profiles!inner ( email, first_name, last_name, avatar_url )')
            .eq('dojo_id', dojoId)
            .order('role'),
        supabase
            .from('dojo_invitations')
            .select('id, email, role, created_at')
            .eq('dojo_id', dojoId)
            .is('accepted_at', null)
            .order('created_at', { ascending: false }),
    ])

    return NextResponse.json({ members: members ?? [], invitations: invitations ?? [] })
}

/** POST { dojo_id, email, role } → asigna, o invita si la persona no existe */
export async function POST(req: Request) {
    const body = await req.json().catch(() => null)
    const dojoId = body?.dojo_id
    const email = normalizeEmail(body?.email)
    const role = body?.role as DojoRole

    if (!dojoId || !email) {
        return NextResponse.json({ error: 'Faltan dojo_id o un email válido' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    const guard = await requireDojoManager(dojoId)
    if (guard.error) return guard.error

    const supabase = await getServerSupabase()

    // ¿La persona ya tiene cuenta? Si sí, alta directa; el rodeo de la
    // invitación sólo hace falta cuando todavía no existe el auth.users.
    const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, email, first_name, last_name')
        .ilike('email', email)
        .maybeSingle()

    if (profile) {
        const { data, error } = await supabase
            .from('dojo_members')
            .upsert(
                { dojo_id: dojoId, user_id: profile.user_id, role, is_active: true },
                { onConflict: 'dojo_id,user_id' }
            )
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        return NextResponse.json({ kind: 'member', member: data, profile })
    }

    const { data, error } = await supabase
        .from('dojo_invitations')
        .upsert(
            { dojo_id: dojoId, email, role, invited_by: guard.ctx.userId },
            { onConflict: 'dojo_id,email' }
        )
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ kind: 'invitation', invitation: data })
}

/** PATCH { dojo_id, member_id, role } → cambia el rol de alguien del equipo */
export async function PATCH(req: Request) {
    const body = await req.json().catch(() => null)
    const { dojo_id: dojoId, member_id: memberId } = body ?? {}
    const role = body?.role as DojoRole

    if (!dojoId || !memberId) {
        return NextResponse.json({ error: 'Faltan dojo_id o member_id' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    const guard = await requireDojoManager(dojoId)
    if (guard.error) return guard.error

    const supabase = await getServerSupabase()

    // No dejar la sede sin ningún administrador: quedaría sin nadie que la opere
    // y habría que subir al superadmin de la marca para reasignar.
    if (role !== 'admin') {
        const { data: target } = await supabase
            .from('dojo_members')
            .select('role')
            .eq('id', memberId)
            .maybeSingle()

        if (target?.role === 'admin') {
            const { count } = await supabase
                .from('dojo_members')
                .select('id', { count: 'exact', head: true })
                .eq('dojo_id', dojoId)
                .eq('role', 'admin')
                .eq('is_active', true)

            if ((count ?? 0) <= 1) {
                return NextResponse.json(
                    { error: 'Es el único administrador de la sede. Asigná otro antes de cambiarle el rol.' },
                    { status: 409 }
                )
            }
        }
    }

    const { data, error } = await supabase
        .from('dojo_members')
        .update({ role })
        .eq('id', memberId)
        .eq('dojo_id', dojoId)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ member: data })
}

/** DELETE ?dojo_id=&member_id=  |  ?dojo_id=&invitation_id= */
export async function DELETE(req: Request) {
    const params = new URL(req.url).searchParams
    const dojoId = params.get('dojo_id')
    const memberId = params.get('member_id')
    const invitationId = params.get('invitation_id')

    if (!dojoId || (!memberId && !invitationId)) {
        return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const guard = await requireDojoManager(dojoId)
    if (guard.error) return guard.error

    const supabase = await getServerSupabase()

    if (invitationId) {
        const { error } = await supabase
            .from('dojo_invitations')
            .delete()
            .eq('id', invitationId)
            .eq('dojo_id', dojoId)

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ ok: true })
    }

    const { data: target } = await supabase
        .from('dojo_members')
        .select('role, user_id')
        .eq('id', memberId!)
        .eq('dojo_id', dojoId)
        .maybeSingle()

    if (!target) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Misma protección que en PATCH: no dejar la sede sin administradores.
    if (target.role === 'admin') {
        const { count } = await supabase
            .from('dojo_members')
            .select('id', { count: 'exact', head: true })
            .eq('dojo_id', dojoId)
            .eq('role', 'admin')
            .eq('is_active', true)

        if ((count ?? 0) <= 1) {
            return NextResponse.json(
                { error: 'Es el único administrador de la sede. Asigná otro antes de quitarlo.' },
                { status: 409 }
            )
        }
    }

    const { error } = await supabase.from('dojo_members').delete().eq('id', memberId!).eq('dojo_id', dojoId)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
}
