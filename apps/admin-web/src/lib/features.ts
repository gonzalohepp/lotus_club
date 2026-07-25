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
