import { NextResponse } from 'next/server'

import { getServerSupabase, requirePlatformAdmin } from '@/lib/tenant/server'

/**
 * /api/superadmin/orgs — Alta y edición de organizaciones.
 *
 * Sólo platform admin. RLS ya lo exige a nivel base ("orgs manage platform"),
 * pero el guard corta antes y devuelve un error entendible en vez de una fila
 * vacía silenciosa.
 */

function slugify(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48)
}

export async function POST(req: Request) {
    const guard = await requirePlatformAdmin()
    if (guard.error) return guard.error

    const body = await req.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''

    if (!name) {
        return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
    }

    const supabase = await getServerSupabase()

    const { data, error } = await supabase
        .from('organizations')
        .insert({
            name,
            slug: slugify(body.slug || name),
            plan: body.plan === 'pro' ? 'pro' : 'basic',
        })
        .select()
        .single()

    if (error) {
        // 23505 = unique_violation sobre el slug
        const message = error.code === '23505' ? 'Ya existe una organización con ese slug' : error.message
        return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ org: data })
}

export async function PATCH(req: Request) {
    const guard = await requirePlatformAdmin()
    if (guard.error) return guard.error

    const body = await req.json().catch(() => null)
    if (!body?.id) {
        return NextResponse.json({ error: 'Falta el id' }, { status: 400 })
    }

    const supabase = await getServerSupabase()

    // Lista blanca de campos: evita que un body inesperado toque columnas que
    // no queremos exponer (created_at, id, ...).
    const patch: Record<string, unknown> = {}
    if (typeof body.name === 'string') patch.name = body.name.trim()
    if (typeof body.slug === 'string') patch.slug = slugify(body.slug)
    if (body.plan === 'basic' || body.plan === 'pro') patch.plan = body.plan
    if (body.features && typeof body.features === 'object') patch.features = body.features
    if (body.branding && typeof body.branding === 'object') patch.branding = body.branding
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('organizations')
        .update(patch)
        .eq('id', body.id)
        .select()
        .single()

    if (error) {
        const message = error.code === '23505' ? 'Ya existe una organización con ese slug' : error.message
        return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ org: data })
}
