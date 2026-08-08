import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

import { ACTIVE_DOJO_COOKIE } from './constants'
import {
    DEFAULT_BILLING,
    isManager,
    isStaff,
    type Dojo,
    type DojoRole,
    type Organization,
    type OrgRole,
    type TenantContext,
    CapabilityOverrides,
    EditableCapability,
} from './types'

/**
 * server.ts — Resolución del tenant en el servidor.
 *
 * Toda ruta y Server Component que toque datos de un dojo debe empezar por
 * `getTenantContext()` y filtrar por `activeDojo.id`. RLS ya impide leer dojos
 * ajenos, pero sin el filtro explícito un admin de dos sedes vería las dos
 * mezcladas.
 */

export { ACTIVE_DOJO_COOKIE }

export async function getServerSupabase() {
    const cookieStore = await cookies()

    return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
            get: (name: string) => cookieStore.get(name)?.value,
            set: () => {
                /* no-op: las cookies de sesión las escribe el middleware */
            },
            remove: () => {
                /* no-op */
            },
        },
    })
}

type DojoWithOrg = Dojo & { role: DojoRole; org: Organization }

/**
 * Fila cruda de la query de pertenencias. Supabase devuelve el join anidado,
 * y `organizations` viene como objeto (relación a uno) aunque el tipo generado
 * a veces lo infiera como array.
 */
type MembershipRow = {
    role: DojoRole
    dojos: (Omit<Dojo, 'org_id'> & {
        org_id: string
        organizations: Organization | Organization[] | null
    }) | null
}

function normalizeDojo(row: MembershipRow): DojoWithOrg | null {
    const d = row.dojos
    if (!d) return null

    const orgRaw = d.organizations
    const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) ?? null
    if (!org) return null

    return {
        id: d.id,
        org_id: d.org_id,
        slug: d.slug,
        name: d.name,
        city: d.city ?? null,
        address: d.address ?? null,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        phone: d.phone ?? null,
        timezone: d.timezone ?? 'America/Argentina/Buenos_Aires',
        branding: d.branding ?? {},
        billing: { ...DEFAULT_BILLING, ...(d.billing ?? {}) },
        qr_fixed: d.qr_fixed ?? false,
        is_active: d.is_active ?? true,
        role: row.role,
        org: {
            ...org,
            features: org.features ?? {},
            branding: org.branding ?? {},
        },
    }
}

const DOJO_SELECT = `
    role,
    dojos!inner (
        id, org_id, slug, name, city, address, lat, lng, phone, timezone,
        branding, billing, qr_fixed, is_active,
        organizations!inner ( id, slug, name, plan, features, branding, is_active )
    )
`

/**
 * Contexto completo del usuario: sus dojos, cuál está activo y si es
 * superusuario. Devuelve `null` si no hay sesión.
 *
 * El dojo activo sale de la cookie; si la cookie apunta a un dojo al que ya no
 * pertenece (lo dieron de baja, o la copió de otra sesión) se cae al primero
 * disponible en vez de romper.
 */
export async function getTenantContext(): Promise<TenantContext | null> {
    const supabase = await getServerSupabase()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const [
        { data: memberships, error: membershipsError },
        { data: platformAdmin },
        { data: orgRoles },
    ] = await Promise.all([
        supabase.from('dojo_members').select(DOJO_SELECT).eq('user_id', user.id).eq('is_active', true),
        supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true),
    ])

    // Un fallo acá degrada al usuario a "sin sede", y sin sede el layout lo trata
    // como alumno: desaparece el menú y todo parece un problema de permisos.
    // La causa suele ser mucho más tonta — una migración sin aplicar deja el
    // select pidiendo una columna que no existe y PostgREST rechaza la query
    // entera. Loguearlo ahorra media hora de buscar el bug donde no está.
    if (membershipsError) {
        console.error(
            '[tenant] no se pudieron leer las sedes del usuario:',
            membershipsError.message,
            '— ¿falta aplicar alguna migración?'
        )
    }

    const isPlatformAdmin = !!platformAdmin
    const orgRoleByOrg = new Map<string, OrgRole>((orgRoles ?? []).map((r) => [r.org_id, r.role as OrgRole]))
    const orgIds = [...orgRoleByOrg.keys()]

    let dojos = ((memberships ?? []) as unknown as MembershipRow[])
        .map(normalizeDojo)
        .filter((d): d is DojoWithOrg => d !== null && d.is_active)

    // Dos casos donde la lista NO sale de `dojo_members`:
    //   · platform admin → todas las sedes de todas las organizaciones
    //   · superadmin de marca → todas las sedes de SU organización, sin
    //     necesitar una fila por sucursal
    // RLS ya limita lo que devuelve la query; acá sólo elegimos qué pedir.
    if (isPlatformAdmin || orgIds.length > 0) {
        const query = supabase
            .from('dojos')
            .select(
                'id, org_id, slug, name, city, address, lat, lng, phone, timezone, branding, billing, qr_fixed, is_active, organizations!inner ( id, slug, name, plan, features, branding, is_active )'
            )
            .eq('is_active', true)
            .order('name')

        const { data: all, error: allError } = isPlatformAdmin
            ? await query
            : await query.in('org_id', orgIds)

        if (allError) {
            console.error(
                '[tenant] no se pudieron listar las sedes:',
                allError.message,
                '— ¿falta aplicar alguna migración?'
            )
        }

        const own = new Map(dojos.map((d) => [d.id, d]))

        const extra = (all ?? [])
            .map((d) =>
                normalizeDojo({
                    // Rol efectivo en la sede: el explícito si lo tiene, si no el
                    // que hereda de la marca.
                    role: own.get(d.id)?.role ?? (orgRoleByOrg.get(d.org_id) === 'manager' ? 'instructor' : 'admin'),
                    dojos: d as MembershipRow['dojos'],
                })
            )
            .filter((d): d is DojoWithOrg => d !== null)

        const merged = new Map(extra.map((d) => [d.id, d]))
        for (const d of dojos) merged.set(d.id, d)
        dojos = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
    }

    const cookieStore = await cookies()
    const requested = cookieStore.get(ACTIVE_DOJO_COOKIE)?.value

    const activeDojo = dojos.find((d) => d.id === requested) ?? dojos[0] ?? null

    // Overrides de permisos de la organización activa. Sin filas, `capabilities()`
    // usa sus defaults, así que una org nueva se comporta igual que antes.
    let capabilityOverrides: CapabilityOverrides = {}
    if (activeDojo) {
        const { data: rows } = await supabase
            .from('role_capabilities')
            .select('role, capability, enabled')
            .eq('org_id', activeDojo.org_id)

        capabilityOverrides = (rows ?? []).reduce<CapabilityOverrides>((acc, r) => {
            const role = r.role as string
            acc[role] = { ...(acc[role] ?? {}), [r.capability as EditableCapability]: r.enabled }
            return acc
        }, {})
    }

    return {
        userId: user.id,
        isPlatformAdmin,
        orgRole: activeDojo ? orgRoleByOrg.get(activeDojo.org_id) ?? null : null,
        orgIds,
        dojos,
        activeDojo,
        capabilityOverrides,
    }
}

// ---------------------------------------------------------------------------
// Guards para API routes
// ---------------------------------------------------------------------------

type TenantGuardOk = { ctx: TenantContext; dojoId: string; role: DojoRole; error?: undefined }
type TenantGuardErr = { error: NextResponse; ctx?: undefined; dojoId?: undefined; role?: undefined }
export type TenantGuard = TenantGuardOk | TenantGuardErr

/**
 * Exige sesión + un dojo activo válido.
 *
 * `dojoId` opcional permite a una ruta operar sobre un dojo explícito (ej. el
 * panel de superadmin editando otro dojo) verificando igual la pertenencia.
 */
export async function requireDojo(dojoId?: string): Promise<TenantGuard> {
    const ctx = await getTenantContext()

    if (!ctx) {
        return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
    }

    const target = dojoId ? ctx.dojos.find((d) => d.id === dojoId) : ctx.activeDojo

    if (!target) {
        return { error: NextResponse.json({ error: 'Dojo no encontrado o sin acceso' }, { status: 403 }) }
    }

    return { ctx, dojoId: target.id, role: target.role }
}

/** Exige rol de staff (admin/instructor) en el dojo. */
export async function requireDojoStaff(dojoId?: string): Promise<TenantGuard> {
    const guard = await requireDojo(dojoId)
    if (guard.error) return guard

    if (!guard.ctx.isPlatformAdmin && !isStaff(guard.role)) {
        return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
    }
    return guard
}

/** Exige rol de gestión (admin): plata y configuración del dojo. */
export async function requireDojoManager(dojoId?: string): Promise<TenantGuard> {
    const guard = await requireDojo(dojoId)
    if (guard.error) return guard

    if (!guard.ctx.isPlatformAdmin && !isManager(guard.role)) {
        return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
    }
    return guard
}

/** Exige superusuario de plataforma. Protege todo /superadmin y su API. */
export async function requirePlatformAdmin(): Promise<
    { ctx: TenantContext; error?: undefined } | { error: NextResponse; ctx?: undefined }
> {
    const ctx = await getTenantContext()

    if (!ctx) {
        return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
    }
    if (!ctx.isPlatformAdmin) {
        // 404 en vez de 403: no revelamos que /superadmin existe.
        return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    }
    return { ctx }
}
