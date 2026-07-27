/**
 * Sistema de planes (Basic / Pro) para desplegar instancias reducidas del
 * panel a nuevos clientes. Cada cliente tiene su propia instancia (Vercel +
 * Supabase propios); este módulo NO es multi-tenant, solo prende/apaga
 * secciones de la UI/API según NEXT_PUBLIC_PLAN.
 *
 * Sin dependencias de Node ni del Edge runtime: se importa desde un Client
 * Component (AdminLayout), desde API routes (Node) y desde middleware.ts (Edge).
 */

export type Plan = 'basic' | 'pro'

export type FeatureKey =
    | 'qr'
    | 'members'
    | 'classes'
    | 'accessLog'
    | 'academies'
    | 'graduations'
    | 'payments'
    | 'mercadopago'
    | 'metrics'
    | 'reports'
    | 'asistenciaVivo'
    | 'notifications'

/** Usado también por UpgradeModal para armar la tabla comparativa Basic/Pro. */
export const FEATURES_BY_PLAN: Record<Plan, Record<FeatureKey, boolean>> = {
    basic: {
        qr: true,
        members: true,
        classes: true,
        accessLog: true,
        // Academias queda accesible en Basic (limitada a 1 sede vía
        // getAcademyLimit(): la landing pública necesita al menos una fila en
        // `academies` para el mapa, y el admin tiene que poder editarla).
        academies: true,
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
        academies: true,
        graduations: true,
        payments: true,
        mercadopago: true,
        metrics: true,
        reports: true,
        asistenciaVivo: true,
        notifications: true,
    },
}

export const PLAN: Plan = process.env.NEXT_PUBLIC_PLAN === 'basic' ? 'basic' : 'pro'

export function hasFeature(key: FeatureKey): boolean {
    return FEATURES_BY_PLAN[PLAN][key]
}

/** Prefijos de ruta gateados por feature, usado por middleware.ts a nivel edge. */
export const ROUTE_FEATURES: Record<string, FeatureKey> = {
    '/payments': 'payments',
    '/metricas': 'metrics',
    '/reportes': 'reports',
    '/asistencia-vivo': 'asistenciaVivo',
    '/notificaciones': 'notifications',
}

/** Cantidad máxima de sedes (academias) permitidas por plan. `null` = sin límite. */
const ACADEMY_LIMIT_BY_PLAN: Record<Plan, number | null> = {
    basic: 1,
    pro: null,
}

export function getAcademyLimit(): number | null {
    return ACADEMY_LIMIT_BY_PLAN[PLAN]
}

/**
 * Cobro online con Mercado Pago = DOS capas que deben cumplirse a la vez:
 *
 *  1) Capa de PLAN — `mercadopago` en FEATURES_BY_PLAN (Basic ❌, Pro ✅).
 *     Define si el plan de esta instancia incluye la posibilidad de cobrar
 *     online. Se muestra como diferenciador en la tabla comparativa (UpgradeModal).
 *
 *  2) Toggle OPERATIVO — NEXT_PUBLIC_MERCADOPAGO. Aunque el plan incluya MP, el
 *     botón de cobro sólo se muestra si además este toggle está en 'on'. Sirve
 *     para tener MP disponible en Pro pero apagado hasta empezar a usarlo.
 *
 * `mercadoPagoEnabled()` es la única fuente de verdad: prende/apaga TODO lo de
 * MP a la vez (opción de cobro en PaymentModal, checkout del alumno en
 * validate/suscripción y las rutas /api/payments/mp/*). Para activar el cobro
 * online en una instancia Pro: NEXT_PUBLIC_MERCADOPAGO=on (+ MP_ACCESS_TOKEN).
 */
const MERCADOPAGO_TOGGLE = process.env.NEXT_PUBLIC_MERCADOPAGO === 'on'

export function mercadoPagoEnabled(): boolean {
    return hasFeature('mercadopago') && MERCADOPAGO_TOGGLE
}
