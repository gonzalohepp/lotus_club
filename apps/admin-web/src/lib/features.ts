/**
 * features.ts — Planes Basic/Pro resueltos en RUNTIME desde la base.
 *
 * ANTES (single-tenant): el plan era `NEXT_PUBLIC_PLAN`, una variable de build.
 * Cambiar a un cliente de Basic a Pro requería redeploy, y cada cliente tenía su
 * propia instancia de Vercel + Supabase.
 *
 * AHORA (multi-tenant): el plan vive en `organizations.plan` y los overrides en
 * `organizations.features`. Se cambia desde /superadmin y aplica al instante,
 * sin redeploy y sin tocar código.
 *
 * Las funciones de este módulo son PURAS: reciben plan + overrides y devuelven
 * el mapa de features. Quien tiene que conseguir esos datos es el llamador
 * (`useTenant()` en cliente, `getTenantContext()` en servidor). Así el módulo
 * sigue sirviendo en los tres runtimes: browser, Node y Edge (middleware).
 */

import type { FeatureKey, Plan } from './tenant/types'

export type { FeatureKey, Plan }

/** Defaults por plan. Los overrides por organización pisan estos valores. */
export const FEATURES_BY_PLAN: Record<Plan, Record<FeatureKey, boolean>> = {
    basic: {
        qr: true,
        members: true,
        classes: true,
        accessLog: true,
        // Gestión de sedes: en Basic queda accesible pero limitada a 1 dojo
        // (ver getDojoLimit), porque la landing pública necesita al menos una.
        dojos: true,
        graduations: false,
        payments: false,
        mercadopago: false,
        metrics: false,
        reports: false,
        asistenciaVivo: false,
        notifications: false,
    },
    pro: {
        qr: true,
        members: true,
        classes: true,
        accessLog: true,
        dojos: true,
        graduations: true,
        payments: true,
        mercadopago: true,
        metrics: true,
        reports: true,
        asistenciaVivo: true,
        notifications: true,
    },
}

export type FeatureOverrides = Partial<Record<FeatureKey, boolean>>

/**
 * Mapa final de features de una organización: defaults del plan + overrides.
 *
 * Los overrides sirven para vender extras sueltos ("Basic + métricas") sin
 * inventar planes nuevos.
 */
export function resolveFeatures(plan: Plan, overrides: FeatureOverrides = {}): Record<FeatureKey, boolean> {
    return { ...FEATURES_BY_PLAN[plan], ...overrides }
}

export function hasFeature(plan: Plan, overrides: FeatureOverrides, key: FeatureKey): boolean {
    return resolveFeatures(plan, overrides)[key] === true
}

/** Prefijos de ruta gateados por feature. Lo usa el middleware a nivel edge. */
export const ROUTE_FEATURES: Record<string, FeatureKey> = {
    '/payments': 'payments',
    '/metricas': 'metrics',
    '/reportes': 'reports',
    '/asistencia-vivo': 'asistenciaVivo',
    '/notificaciones': 'notifications',
}

export function featureForPath(pathname: string): FeatureKey | null {
    const entry = Object.entries(ROUTE_FEATURES).find(([prefix]) => pathname.startsWith(prefix))
    return entry ? entry[1] : null
}

/** Cantidad máxima de dojos (sedes) por plan. `null` = sin límite. */
const DOJO_LIMIT_BY_PLAN: Record<Plan, number | null> = {
    basic: 1,
    pro: null,
}

export function getDojoLimit(plan: Plan): number | null {
    return DOJO_LIMIT_BY_PLAN[plan]
}

/**
 * Cobro online con Mercado Pago = DOS capas que deben cumplirse a la vez:
 *
 *  1) Capa de PLAN — `mercadopago` en FEATURES_BY_PLAN (Basic ❌, Pro ✅).
 *     Define si el plan de la organización incluye cobrar online.
 *
 *  2) Toggle OPERATIVO — `dojos.billing.mercadopago_enabled`. Aunque el plan lo
 *     incluya, el botón sólo aparece si el dojo lo prendió. Permite tener MP
 *     disponible en Pro pero apagado hasta que la sede empiece a usarlo, y que
 *     una sede lo use y otra no.
 *
 * Ojo: el token de MP (`MP_ACCESS_TOKEN`) sigue siendo por instancia. Si dos
 * organizaciones necesitan cuentas de Mercado Pago distintas hay que moverlo a
 * `organizations.secrets` — está anotado en SETUP-MULTITENANT.md.
 */
export function mercadoPagoEnabled(
    plan: Plan,
    overrides: FeatureOverrides,
    dojoMercadoPagoOn: boolean | undefined
): boolean {
    return hasFeature(plan, overrides, 'mercadopago') && dojoMercadoPagoOn === true
}

/** Etiquetas para la tabla comparativa Basic/Pro del UpgradeModal. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
    qr: 'Control de acceso QR',
    members: 'Gestión de alumnos',
    classes: 'Clases y horarios',
    accessLog: 'Historial de ingresos',
    dojos: 'Sedes',
    graduations: 'Graduaciones y cinturones',
    payments: 'Pagos y cuotas',
    mercadopago: 'Cobro online (Mercado Pago)',
    metrics: 'Métricas y mapas de calor',
    reports: 'Reportes exportables',
    asistenciaVivo: 'Asistencia en vivo',
    notifications: 'Notificaciones push',
}
