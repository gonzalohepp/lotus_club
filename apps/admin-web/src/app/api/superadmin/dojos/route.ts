import { NextResponse } from 'next/server'

import { getDojoLimit } from '@/lib/features'
import { getServerSupabase, requirePlatformAdmin } from '@/lib/tenant/server'
import type { BillingConfig, BillingTier } from '@/lib/tenant/types'

/**
 * /api/superadmin/dojos — Alta y edición de sedes, incluida su política de cobro.
 *
 * El PATCH acepta el objeto `billing` completo, así que se valida con cuidado:
 * una config mal formada acá se traduce en alumnos bloqueados por error o en
 * recargos que no corresponden.
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

/**
 * Normaliza y valida las reglas de cobro. Devuelve el error como string, o la
 * config saneada. Rechaza lo que rompería el motor; el resto (huecos entre
 * tramos, por ejemplo) sólo se advierte en la UI porque tiene default seguro.
 */
function parseBilling(raw: unknown): { error: string } | { config: BillingConfig } {
    if (!raw || typeof raw !== 'object') return { error: 'billing inválido' }

    const b = raw as Partial<BillingConfig>

    if (!Array.isArray(b.tiers) || b.tiers.length === 0) {
        return { error: 'Definí al menos un tramo de cobro' }
    }

    const tiers: BillingTier[] = []

    for (const t of b.tiers) {
        const from = Number(t?.from_day)
        const to = t?.to_day === null || t?.to_day === undefined ? null : Number(t.to_day)
        const pct = Number(t?.surcharge_pct ?? 0)

        if (!Number.isInteger(from) || from < 1 || from > 31) {
            return { error: `Día de inicio inválido: ${t?.from_day}` }
        }
        if (to !== null && (!Number.isInteger(to) || to < from || to > 31)) {
            return { error: `Día de fin inválido en el tramo que arranca el ${from}` }
        }
        if (!Number.isFinite(pct) || pct < 0 || pct > 1000) {
            return { error: `Recargo inválido en el tramo que arranca el ${from}` }
        }

        tiers.push({
            from_day: from,
            to_day: to,
            surcharge_pct: pct,
            blocks_access: t?.blocks_access === true,
            label: typeof t?.label === 'string' && t.label.trim() ? t.label.trim() : `Día ${from}+`,
        })
    }

    const months = Number(b.months_overdue_blocks ?? 2)
    if (!Number.isInteger(months) || months < 1 || months > 60) {
        return { error: 'Meses de atraso inválido' }
    }

    const rounding = Number(b.rounding ?? 0)
    if (!Number.isFinite(rounding) || rounding < 0) {
        return { error: 'Redondeo inválido' }
    }

    const dueDay = Number(b.due_day ?? 10)
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        return { error: 'Día de vencimiento inválido' }
    }

    return {
        config: {
            due_day: dueDay,
            tiers: tiers.sort((a, b) => a.from_day - b.from_day),
            months_overdue_blocks: months,
            exempt_roles: Array.isArray(b.exempt_roles)
                ? b.exempt_roles
                : ['admin', 'instructor', 'becado'],
            new_member_exempt: b.new_member_exempt !== false,
            currency: typeof b.currency === 'string' ? b.currency : 'ARS',
            rounding,
        },
    }
}

export async function POST(req: Request) {
    const guard = await requirePlatformAdmin()
    if (guard.error) return guard.error

    const body = await req.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const orgId = body?.org_id

    if (!name || !orgId) {
        return NextResponse.json({ error: 'Faltan nombre u organización' }, { status: 400 })
    }

    const supabase = await getServerSupabase()

    // El límite de sedes por plan se controla acá, no sólo en la UI: el botón
    // deshabilitado no es una restricción.
    const [{ data: org }, { count }] = await Promise.all([
        supabase.from('organizations').select('plan').eq('id', orgId).single(),
        supabase.from('dojos').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ])

    if (!org) {
        return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const limit = getDojoLimit(org.plan)
    if (limit !== null && (count ?? 0) >= limit) {
        return NextResponse.json(
            { error: `El plan ${org.plan} permite ${limit} sede${limit === 1 ? '' : 's'}` },
            { status: 409 }
        )
    }

    const { data, error } = await supabase
        .from('dojos')
        .insert({ org_id: orgId, name, slug: slugify(body.slug || name), city: body.city ?? null })
        .select()
        .single()

    if (error) {
        const message = error.code === '23505' ? 'Ya existe una sede con ese slug en esta organización' : error.message
        return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ dojo: data })
}

export async function PATCH(req: Request) {
    const guard = await requirePlatformAdmin()
    if (guard.error) return guard.error

    const body = await req.json().catch(() => null)
    if (!body?.id) {
        return NextResponse.json({ error: 'Falta el id' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    if (typeof body.name === 'string') patch.name = body.name.trim()
    if (typeof body.slug === 'string') patch.slug = slugify(body.slug)
    if (typeof body.city === 'string') patch.city = body.city || null
    if (typeof body.address === 'string') patch.address = body.address || null
    if (typeof body.phone === 'string') patch.phone = body.phone || null
    if (typeof body.timezone === 'string' && body.timezone.trim()) patch.timezone = body.timezone.trim()
    // `null` es un valor válido: significa "esta sede no se muestra en el mapa".
    // Con un `typeof === 'number'` a secas, quitar la ubicación no se guardaba.
    if (body.lat === null || typeof body.lat === 'number') patch.lat = body.lat
    if (body.lng === null || typeof body.lng === 'number') patch.lng = body.lng
    if (body.branding && typeof body.branding === 'object') patch.branding = body.branding
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active

    if (body.billing !== undefined) {
        const parsed = parseBilling(body.billing)
        if ('error' in parsed) {
            return NextResponse.json({ error: parsed.error }, { status: 400 })
        }
        patch.billing = parsed.config
    }

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
    }

    const supabase = await getServerSupabase()

    const { data, error } = await supabase.from('dojos').update(patch).eq('id', body.id).select().single()

    if (error) {
        const message = error.code === '23505' ? 'Ya existe una sede con ese slug en esta organización' : error.message
        return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ dojo: data })
}

/**
 * DELETE — baja de una sede.
 *
 * Borrar un dojo NO borra sólo la fila: alumnos, pagos, clases, inscripciones,
 * asistencias, accesos, notificaciones y tokens de QR cuelgan de `dojo_id` con
 * `on delete cascade`. Una sede con historial se lleva puesto todo su pasado, y
 * eso no se recupera.
 *
 * Por eso la baja es en dos tiempos:
 *   1. sin `force`, devuelve 409 con el recuento de lo que se perdería
 *   2. con `force: true`, borra
 *
 * Para sacar una sede de circulación sin perder nada está `is_active = false`
 * (PATCH), que es lo que conviene en la mayoría de los casos.
 */
export async function DELETE(req: Request) {
    const guard = await requirePlatformAdmin()
    if (guard.error) return guard.error

    const body = (await req.json().catch(() => null)) as { id?: string; force?: boolean } | null
    if (!body?.id) {
        return NextResponse.json({ error: 'Falta el id de la sede' }, { status: 400 })
    }

    const supabase = await getServerSupabase()

    const { data: dojo } = await supabase
        .from('dojos')
        .select('id, name')
        .eq('id', body.id)
        .maybeSingle()

    if (!dojo) {
        return NextResponse.json({ error: 'La sede no existe' }, { status: 404 })
    }

    // Recuento de lo que se iría en cascada.
    const tables = [
        ['dojo_members', 'personas vinculadas'],
        ['classes', 'clases'],
        ['payments', 'pagos'],
        ['memberships', 'membresías'],
        ['access_logs', 'registros de acceso'],
    ] as const

    const counts: { table: string; label: string; count: number }[] = []
    for (const [table, label] of tables) {
        const { count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('dojo_id', body.id)
        if (count) counts.push({ table, label, count })
    }

    if (counts.length && !body.force) {
        return NextResponse.json(
            {
                error: 'La sede tiene datos asociados',
                dojo: dojo.name,
                counts,
                hint: 'Volvé a enviar con force: true para borrarla igual, o desactivala en vez de borrarla.',
            },
            { status: 409 }
        )
    }

    const { error } = await supabase.from('dojos').delete().eq('id', body.id)
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, deleted: dojo.name, removed: counts })
}
