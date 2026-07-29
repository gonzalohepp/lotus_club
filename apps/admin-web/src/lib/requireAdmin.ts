import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

import { hasFeature, mercadoPagoEnabled, type FeatureKey } from './features'
import { getServerSupabase, getTenantContext, requireDojoManager, requireDojoStaff } from './tenant/server'

/**
 * requireAdmin.ts — Guards de API en modo multi-tenant.
 *
 * Los guards viejos preguntaban "¿este usuario es admin?" contra el rol GLOBAL
 * de `profiles`. Eso ya no alcanza: el rol es por dojo, así que la pregunta
 * correcta es "¿este usuario es admin EN EL DOJO sobre el que está operando?".
 *
 * Toda ruta que toque datos de un dojo debe usar `requireDojoStaff()` o
 * `requireDojoManager()` (reexportados acá) y filtrar por el `dojoId` que
 * devuelven. Un guard que no devuelva dojoId es un guard incompleto.
 */

export { requireDojo, requireDojoManager, requireDojoStaff, requirePlatformAdmin } from './tenant/server'
export type { TenantGuard } from './tenant/server'

type UserAuthResult =
    | { error: NextResponse; user?: undefined; supabase?: undefined }
    | { error?: undefined; user: User; supabase: Awaited<ReturnType<typeof getServerSupabase>> }

/** Requiere sesión válida. No exige ningún rol ni dojo. */
export async function requireUser(): Promise<UserAuthResult> {
    const supabase = await getServerSupabase()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
    }

    return { user, supabase }
}

/**
 * @deprecated Usá `requireDojoManager()`, que además devuelve el `dojoId` por el
 * que hay que filtrar. Este alias existe sólo para no romper rutas viejas: sin
 * el filtro por dojo, un admin de dos sedes ve las dos mezcladas.
 */
export async function requireAdmin(): Promise<{ error: NextResponse; user?: undefined } | { error?: undefined; user: User }> {
    const guard = await requireDojoManager()
    if (guard.error) return { error: guard.error }

    const auth = await requireUser()
    if (auth.error) return { error: auth.error }

    return { user: auth.user }
}

/**
 * Corta rutas cuya feature no está incluida en el plan de la ORGANIZACIÓN del
 * dojo activo. Devuelve 404 en vez de 403 para no revelar que la ruta existe.
 *
 * Es async porque el plan ya no es una constante de build: se lee de la base.
 */
export async function requireFeature(key: FeatureKey): Promise<{ error?: NextResponse }> {
    const ctx = await getTenantContext()
    const org = ctx?.activeDojo?.org

    if (!org || !hasFeature(org.plan, org.features, key)) {
        return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    }
    return {}
}

/**
 * Corta las rutas de Mercado Pago cuando el cobro online está apagado: o porque
 * el plan de la organización no lo incluye, o porque este dojo puntual todavía
 * no lo prendió.
 */
export async function requireMercadoPago(): Promise<{ error?: NextResponse }> {
    const ctx = await getTenantContext()
    const dojo = ctx?.activeDojo

    if (!dojo) {
        return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    }

    const enabled = mercadoPagoEnabled(
        dojo.org.plan,
        dojo.org.features,
        (dojo.billing as { mercadopago_enabled?: boolean }).mercadopago_enabled
    )

    if (!enabled) {
        return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    }
    return {}
}

export { getServerSupabase }
