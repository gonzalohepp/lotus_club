import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { featureForPath, resolveFeatures } from '@/lib/features'
import { ACTIVE_DOJO_COOKIE, ACTIVE_PROFILE_COOKIE, PROFILE_SEDE } from '@/lib/tenant/constants'

/**
 * middleware.ts — Puerta de entrada multi-tenant.
 *
 * Resuelve, en el edge y antes de renderizar:
 *   1. ¿Hay sesión?
 *   2. ¿A qué dojos pertenece y cuál está activo?
 *   3. ¿Su rol EN ESE DOJO le permite entrar a la ruta?
 *   4. ¿El plan de la ORGANIZACIÓN de ese dojo incluye la feature?
 *
 * El paso 3 es lo que cambió con el multi-tenant: antes el rol era global
 * (`profiles.role`), así que un admin lo era en todos lados. Ahora el rol es por
 * dojo, y el mismo usuario puede ser admin en Lanús y alumno en Avellaneda.
 */

/** Rutas del panel de administración (requieren rol de staff en el dojo activo). */
const ADMIN_PATHS = [
    '/admin',
    '/members',
    '/classes',
    '/payments',
    '/torneo',
    '/metricas',
    '/access-log',
    '/qr',
    '/reportes',
    '/asistencia-vivo',
    '/notificaciones',
]

const STAFF_ROLES = new Set(['admin', 'instructor'])

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Las rutas de API validan sesión y tenant por su cuenta (requireDojo*),
    // y algunas son públicas a propósito (webhook de Mercado Pago).
    if (pathname.startsWith('/api')) {
        return NextResponse.next()
    }

    let response = NextResponse.next({ request: { headers: request.headers } })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({ name, value, ...options })
                    response = NextResponse.next({ request: { headers: request.headers } })
                    response.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options })
                    response = NextResponse.next({ request: { headers: request.headers } })
                    response.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const origin = `${protocol}://${host}`

    const isPathAdmin = ADMIN_PATHS.some((p) => pathname.startsWith(p))
    const isPathSuperadmin = pathname.startsWith('/superadmin')
    const isPathProtected =
        isPathAdmin ||
        isPathSuperadmin ||
        pathname.startsWith('/app') ||
        pathname.startsWith('/validate') ||
        pathname.startsWith('/profile')

    if (!user && isPathProtected) {
        return NextResponse.redirect(new URL('/login', origin))
    }

    if (!user) return response

    if (pathname === '/login') {
        return NextResponse.redirect(new URL('/app', origin))
    }

    // ---- Panel de plataforma (el dev) -------------------------------------
    if (isPathSuperadmin) {
        const { data: platformAdmin } = await supabase
            .from('platform_admins')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle()

        // 404 en vez de 403: no revelamos que /superadmin existe.
        if (!platformAdmin) {
            return NextResponse.rewrite(new URL('/404', origin))
        }
        return response
    }

    if (!isPathAdmin) return response

    // ---- Panel del dojo ---------------------------------------------------
    const [{ data: memberships }, { data: platformAdmin }, { data: orgRoles }] = await Promise.all([
        supabase
            .from('dojo_members')
            .select('dojo_id, role, dojos!inner ( is_active, organizations!inner ( plan, features ) )')
            .eq('user_id', user.id)
            .eq('is_active', true),
        supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true),
    ])

    const isPlatformAdmin = !!platformAdmin

    /*
     * Perfil activo. Si la persona eligió entrar como miembro de UNA sede
     * (`sede:<id>`), el rol de marca no cuenta en esta request: se la trata
     * exactamente como a alguien que sólo pertenece a esa sucursal.
     *
     * Sin esto, un Mestre que entra "como alumno de Quilmes" seguía pasando el
     * portón por `isOrgStaff` y podía escribir /payments en la barra de
     * direcciones. RLS no le devolvía nada, así que no era un agujero, pero
     * tampoco era lo que el selector promete.
     */
    const profile = request.cookies.get(ACTIVE_PROFILE_COOKIE)?.value ?? ''
    const requestedSede = profile.startsWith(`${PROFILE_SEDE}:`)
        ? profile.slice(PROFILE_SEDE.length + 1)
        : null

    // Sólo vale si de verdad tiene una fila en esa sede. Una cookie vieja —de
    // una sede dada de baja, o de otra cuenta en el mismo navegador— tiene que
    // ser inocua y no dejar a nadie afuera. `server.ts` la trata igual.
    const sedeProfileId =
        requestedSede && (memberships ?? []).some((m) => m.dojo_id === requestedSede)
            ? requestedSede
            : null

    // Superadmin de marca: es staff de todas las sedes de su organización sin
    // necesitar una fila en dojo_members. Sin este chequeo quedaría rebotado a
    // /validate igual que un alumno.
    const isOrgStaff = !sedeProfileId && (orgRoles ?? []).length > 0

    // El dojo activo sale de la cookie que escribe el switcher; si apunta a algo
    // que ya no existe o al que perdió acceso, cae al primero disponible. En
    // perfil de sede manda el perfil, no el switcher.
    const requestedDojo = sedeProfileId ?? request.cookies.get(ACTIVE_DOJO_COOKIE)?.value
    const active =
        (memberships ?? []).find((m) => m.dojo_id === requestedDojo) ??
        (sedeProfileId ? null : (memberships ?? [])[0] ?? null)

    if ((!isPlatformAdmin || sedeProfileId) && !isOrgStaff) {
        if (!active) {
            console.warn(`[middleware] ${user.email} sin dojo activo intentó entrar a ${pathname}`)
            return NextResponse.redirect(new URL('/validate', origin))
        }

        if (!STAFF_ROLES.has(active.role)) {
            console.warn(`[middleware] ${active.role} ${user.email} bloqueado en ${pathname}`)
            return NextResponse.redirect(new URL('/validate', origin))
        }
    }

    // ---- Gate por plan de la organización dueña del dojo activo -----------
    const feature = featureForPath(pathname)

    if (feature && active && !isPlatformAdmin) {
        // El join anidado puede venir como objeto o como array de un elemento
        // según cómo infiera PostgREST la cardinalidad de la relación.
        const dojo = Array.isArray(active.dojos) ? active.dojos[0] : active.dojos
        const orgRaw = dojo?.organizations
        const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw

        const features = resolveFeatures(org?.plan ?? 'basic', org?.features ?? {})

        if (!features[feature]) {
            return NextResponse.redirect(new URL('/admin', origin))
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Todas las rutas salvo estáticos y assets.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
