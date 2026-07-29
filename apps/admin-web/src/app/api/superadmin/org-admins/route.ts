import { NextResponse } from 'next/server'

import { getServerSupabase, requirePlatformAdmin } from '@/lib/tenant/server'

/**
 * /api/superadmin/org-admins — Superadmins de una organización.
 *
 * Sólo el desarrollador. Si un superadmin pudiera nombrar a otro, el control de
 * la cuenta se propagaría sin que la plataforma lo autorice, y darle de baja a
 * alguien no alcanzaría si ya nombró a un tercero.
 *
 * Igual que con el equipo de una sede, hay dos caminos según si la persona ya
 * tiene cuenta:
 *   · Existe   → se le crea la fila en `org_members` al instante.
 *   · No entró → queda una invitación pendiente a la sede principal de la marca,
 *     y al aceptarla el dev la promueve. Se avisa en la respuesta.
 */

function normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const email = value.trim().toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

/** GET ?org_id=... */
export async function GET(req: Request) {
    const guard = await requirePlatformAdmin()
    if (guard.error) return guard.error

    const orgId = new URL(req.url).searchParams.get('org_id')
    if (!orgId) return NextResponse.json({ error: 'Falta org_id' }, { status: 400 })

    const supabase = await getServerSupabase()

    const { data, error } = await supabase
        .from('org_members')
        .select('id, user_id, role, is_active, created_at, profiles!inner ( email, first_name, last_name )')
        .eq('org_id', orgId)
        .order('created_at')

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ admins: data ?? [] })
}

/** POST { org_id, email, role } */
export async function POST(req: Request) {
    const guard = await requirePlatformAdmin()
    if (guard.error) return guard.error

    const body = await req.json().catch(() => null)
    const orgId = body?.org_id
    const email = normalizeEmail(body?.email)
    const role = body?.role === 'manager' ? 'manager' : 'superadmin'

    if (!orgId || !email) {
        return NextResponse.json({ error: 'Faltan org_id o un email válido' }, { status: 400 })
    }

    const supabase = await getServerSupabase()

    const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, email, first_name, last_name')
        .ilike('email', email)
        .maybeSingle()

    if (!profile) {
        // No se puede crear una cuenta ajena: el login es Google OAuth. A
        // diferencia del equipo de una sede, acá no dejamos una invitación
        // pendiente — sería una promoción automática a superadmin de marca sin
        // que nadie la confirme en el momento en que la persona entra.
        return NextResponse.json(
            {
                error: `${email} todavía no tiene cuenta. Pedile que entre una vez con Google y volvé a agregarlo.`,
            },
            { status: 404 }
        )
    }

    const { data, error } = await supabase
        .from('org_members')
        .upsert(
            { org_id: orgId, user_id: profile.user_id, role, is_active: true },
            { onConflict: 'org_id,user_id' }
        )
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ admin: { ...data, profiles: profile } })
}

/** DELETE ?id=... */
export async function DELETE(req: Request) {
    const guard = await requirePlatformAdmin()
    if (guard.error) return guard.error

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

    const supabase = await getServerSupabase()

    const { error } = await supabase.from('org_members').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
}
