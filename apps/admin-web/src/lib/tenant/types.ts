/**
 * types.ts — Modelo de datos multi-tenant.
 *
 * Jerarquía:
 *   Organization (Lotus)  →  Dojo (Lotus Lanús)  →  DojoMember (persona ↔ dojo)
 *
 * Una persona tiene UN profile global y N pertenencias (una por dojo), cada una
 * con su propio rol. Por eso el rol nunca se lee de `profiles`: se lee de la
 * pertenencia al dojo activo.
 */

/**
 * Rol a nivel ORGANIZACIÓN (la marca). Espeja `public.org_role`.
 *
 * Es el "superadmin" del negocio: ve todas las sucursales de su marca y opera
 * en cualquiera de ellas, pero NO accede a /superadmin (donde vería a los demás
 * clientes de la plataforma) ni da de alta sedes. Ambas cosas son exclusivas de
 * `platform_admins`.
 */
export type OrgRole = 'superadmin' | 'manager'

/** Rol DENTRO de un dojo. Espeja el enum `public.dojo_role`. */
export type DojoRole = 'admin' | 'instructor' | 'member' | 'becado'

/** Roles que pueden ver datos de terceros (padrón, asistencia, logs). */
export const STAFF_ROLES: readonly DojoRole[] = ['admin', 'instructor']

/** Roles que pueden tocar plata y configuración del dojo. */
export const MANAGER_ROLES: readonly DojoRole[] = ['admin']

export function isStaff(role: DojoRole | null | undefined): boolean {
    return !!role && STAFF_ROLES.includes(role)
}

export function isManager(role: DojoRole | null | undefined): boolean {
    return !!role && MANAGER_ROLES.includes(role)
}

// ---------------------------------------------------------------------------
// Cobro
// ---------------------------------------------------------------------------

/**
 * Un tramo de mora. `toDay: null` = "de este día en adelante".
 * Los tramos se evalúan contra el día del mes de HOY, no del vencimiento.
 */
export type BillingTier = {
    from_day: number
    to_day: number | null
    surcharge_pct: number
    blocks_access: boolean
    label: string
}

/**
 * Reglas de cobro de un dojo. Se guardan en `dojos.billing` (jsonb) y las
 * interpretan tanto `billing.ts` (cliente/servidor Next) como
 * `public.billing_eval()` (Postgres). Misma forma, mismas reglas, un solo lugar
 * donde cambiarlas: la UI de configuración del dojo.
 */
export type BillingConfig = {
    /** Día de vencimiento de referencia. Informativo, para textos de UI. */
    due_day: number
    tiers: BillingTier[]
    /** Meses de atraso a partir de los cuales se bloquea sí o sí. */
    months_overdue_blocks: number
    /** Roles que nunca deben cuota. */
    exempt_roles: DojoRole[]
    /** Un alumno que todavía no hizo ningún pago no arrastra recargo. */
    new_member_exempt: boolean
    currency: string
    /** Redondeo del importe final. 0 = sin redondeo, 10 = redondear a $10. */
    rounding: number
}

/** Config por defecto: replica la lógica que tenía Beleza hardcodeada. */
export const DEFAULT_BILLING: BillingConfig = {
    due_day: 10,
    tiers: [
        { from_day: 1, to_day: 10, surcharge_pct: 0, blocks_access: false, label: 'Sin recargo' },
        { from_day: 11, to_day: 19, surcharge_pct: 20, blocks_access: false, label: 'Con recargo' },
        { from_day: 20, to_day: null, surcharge_pct: 20, blocks_access: true, label: 'Bloqueado' },
    ],
    months_overdue_blocks: 2,
    exempt_roles: ['admin', 'instructor', 'becado'],
    new_member_exempt: true,
    currency: 'ARS',
    rounding: 0,
}

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

/**
 * Identidad visual. Vive en `organizations.branding` y puede pisarse por dojo
 * en `dojos.branding` (una sede con su propio color). Los campos vacíos heredan.
 */
export type Branding = {
    primary?: string
    accent?: string
    logo_url?: string
    logo_dark_url?: string
    favicon_url?: string
    /** Nombre a mostrar en el header si difiere del nombre legal. */
    display_name?: string
}

export const DEFAULT_BRANDING: Required<Pick<Branding, 'primary' | 'accent'>> = {
    primary: '#1E40AF',
    accent: '#F59E0B',
}

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export type Plan = 'basic' | 'pro'

/**
 * Secciones del panel que se prenden/apagan por plan. Se define acá (y no en
 * features.ts) para que `features.ts` pueda importar tipos de este módulo sin
 * generar un ciclo de imports.
 */
export type FeatureKey =
    | 'qr'
    | 'members'
    | 'classes'
    | 'accessLog'
    | 'dojos'
    | 'graduations'
    | 'payments'
    | 'mercadopago'
    | 'metrics'
    | 'reports'
    | 'asistenciaVivo'
    | 'notifications'

export type Organization = {
    id: string
    slug: string
    name: string
    plan: Plan
    /** Overrides puntuales sobre los defaults del plan. */
    features: Partial<Record<FeatureKey, boolean>>
    branding: Branding
    is_active: boolean
}

export type Dojo = {
    id: string
    org_id: string
    slug: string
    name: string
    city: string | null
    address: string | null
    lat: number | null
    lng: number | null
    phone: string | null
    timezone: string
    branding: Branding
    billing: BillingConfig
    /**
     * true = el QR se imprime y no rota. Para sedes sin pantalla en la puerta.
     * false = rotativo cada 30s, que impide que la foto del código sirva.
     */
    qr_fixed: boolean
    is_active: boolean
}


/**
 * Lo que la app necesita saber en cada request: quién sos, en qué dojo estás
 * parado, qué podés hacer ahí y con qué marca se pinta la pantalla.
 */
export type TenantContext = {
    userId: string
    /** Desarrollador: ve todas las organizaciones y accede a /superadmin. */
    isPlatformAdmin: boolean
    /**
     * Rol de marca en la organización del dojo activo. `superadmin` ve y
     * administra todas las sedes de esa organización; null = sólo tiene roles
     * a nivel sede.
     */
    orgRole: OrgRole | null
    /** Organizaciones donde tiene rol de marca. */
    orgIds: string[]
    /** Todos los dojos visibles (arma el switcher). */
    dojos: (Dojo & { role: DojoRole; org: Organization })[]
    /** Dojo actualmente seleccionado. null sólo si la persona no pertenece a ninguno. */
    activeDojo: (Dojo & { role: DojoRole; org: Organization }) | null
}

/**
 * Capacidades derivadas del rol. Se calculan en un solo lugar para que la UI,
 * el middleware y las API routes no repitan la misma condición con criterios
 * distintos.
 *
 * Distinto de las FEATURES, que dependen del PLAN contratado: acá se trata de
 * qué puede hacer esta persona, no de qué incluye el plan. Las dos condiciones
 * se aplican juntas (plan Pro + rol suficiente).
 */
export type Capability =
    /** Consola de plataforma: alta de organizaciones, planes, otros clientes. */
    | 'platformConsole'
    /** Ver el listado de sedes de la marca (el ítem "Academias" del sidebar). */
    | 'viewDojos'
    /**
     * Alta, edición y baja de sedes. Por ahora exclusivo del desarrollador: el
     * límite de sedes por plan (Basic = 1, Pro = ilimitadas) es una condición
     * comercial, y si la marca pudiera crearlas sola sería apenas una
     * sugerencia. El superadmin las ve (`viewDojos`) y las pide.
     */
    | 'manageDojos'
    /** Alta y baja de superadmins de una organización. Sólo el desarrollador. */
    | 'manageOrgAdmins'
    /** Configuración de la sede: datos, branding, equipo. */
    | 'manageDojoSettings'
    /**
     * Reglas de mora, recargos y bloqueo. Exclusivo del desarrollador: define
     * cuánto se le cobra de más a un alumno y cuándo se le corta el acceso.
     * Reforzado en la base por el trigger `enforce_billing_dev_only()`.
     */
    | 'manageBilling'
    /** Alta y edición de alumnos, clases y pagos de la sede. */
    | 'manageMembers'

export function capabilities(ctx: {
    isPlatformAdmin: boolean
    orgRole: OrgRole | null
    role: DojoRole | null
}): Record<Capability, boolean> {
    const { isPlatformAdmin, orgRole, role } = ctx

    const isOrgAdmin = orgRole === 'superadmin'
    const isOrgStaff = orgRole !== null

    return {
        platformConsole: isPlatformAdmin,
        // El superadmin ve las sedes de su marca; el admin de una sucursal no
        // ve esta sección. Darlas de alta es del desarrollador.
        viewDojos: isPlatformAdmin || isOrgAdmin,
        manageDojos: isPlatformAdmin,
        // Quién es superadmin de una marca lo decide el desarrollador: si un
        // superadmin pudiera nombrar a otro, el control de la cuenta se
        // propagaría sin que la plataforma lo autorice.
        manageOrgAdmins: isPlatformAdmin,
        // Sin rol de dueño de sucursal, los datos y el equipo de cada sede los
        // define la marca.
        manageDojoSettings: isPlatformAdmin || isOrgAdmin,
        // La lógica de cobro no: es del desarrollador y de nadie más.
        manageBilling: isPlatformAdmin,
        manageMembers: isPlatformAdmin || isOrgStaff || role === 'admin',
    }
}
