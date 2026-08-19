'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'

import { getDojoLimit, mercadoPagoEnabled, resolveFeatures } from '../features'
import { ACTIVE_DOJO_COOKIE, ACTIVE_DOJO_MAX_AGE, ACTIVE_PROFILE_COOKIE } from './constants'
import {
    capabilities,
    DEFAULT_BRANDING,
    isManager,
    isStaff,
    type Branding,
    type Capability,
    type FeatureKey,
    type TenantContext as TenantContextValue,
} from './types'

/**
 * context.tsx — El tenant activo, disponible en todo el árbol de cliente.
 *
 * Se hidrata UNA vez desde el layout server-side (que ya resolvió sesión, dojos
 * y permisos) y de ahí en más los componentes lo leen con `useTenant()` sin
 * volver a pegarle a la base.
 */

const TenantCtx = createContext<TenantContextValue | null>(null)

export function TenantProvider({
    value,
    children,
}: {
    value: TenantContextValue | null
    children: React.ReactNode
}) {
    return <TenantCtx.Provider value={value}>{children}</TenantCtx.Provider>
}

export function useTenant() {
    const ctx = useContext(TenantCtx)

    const activeDojo = ctx?.activeDojo ?? null
    const org = activeDojo?.org ?? null
    const role = activeDojo?.role ?? null

    // El branding del dojo pisa selectivamente al de la organización: una sede
    // puede cambiar sólo el color y heredar el logo.
    const branding: Branding = useMemo(
        () => ({ ...DEFAULT_BRANDING, ...(org?.branding ?? {}), ...(activeDojo?.branding ?? {}) }),
        [org?.branding, activeDojo?.branding]
    )

    const features = useMemo(
        () => resolveFeatures(org?.plan ?? 'basic', org?.features ?? {}),
        [org?.plan, org?.features]
    )

    const can = useCallback((key: FeatureKey) => features[key] === true, [features])

    /** Cambia de dojo: persiste la elección y recarga para re-resolver server-side. */
    const switchDojo = useCallback((dojoId: string) => {
        // Path raíz para que valga en toda la app; el nombre y la duración
        // salen de constants.ts, que es de donde los lee el servidor.
        document.cookie = `${ACTIVE_DOJO_COOKIE}=${dojoId}; path=/; max-age=${ACTIVE_DOJO_MAX_AGE}; samesite=lax`
        window.location.reload()
    }, [])

    /**
     * Cambia de PERFIL (el sombrero), no de sede.
     *
     * Borra de paso la sede activa: la que estaba elegida puede no existir en el
     * perfil nuevo —un perfil de sede ve una sola sucursal— y sin esto el
     * servidor caería al primer dojo de la lista con la cookie vieja pegada,
     * que después reaparece al volver al perfil de marca.
     */
    const switchProfile = useCallback((profileId: string) => {
        document.cookie = `${ACTIVE_PROFILE_COOKIE}=${profileId}; path=/; max-age=${ACTIVE_DOJO_MAX_AGE}; samesite=lax`
        document.cookie = `${ACTIVE_DOJO_COOKIE}=; path=/; max-age=0; samesite=lax`
        window.location.reload()
    }, [])

    const orgRole = ctx?.orgRole ?? null

    // Qué puede HACER esta persona, según su rol. Ortogonal a `features`, que
    // dice qué incluye el PLAN. La UI casi siempre necesita las dos.
    const roleInherited = activeDojo?.roleInherited ?? false

    const caps = useMemo(
        () => capabilities({
            isPlatformAdmin: ctx?.isPlatformAdmin ?? false,
            orgRole,
            role,
            roleInherited,
            overrides: ctx?.capabilityOverrides,
        }),
        [ctx?.isPlatformAdmin, orgRole, role, roleInherited, ctx?.capabilityOverrides]
    )

    const allows = useCallback((key: Capability) => caps[key], [caps])

    return {
        ...(ctx ?? {
            userId: '',
            isPlatformAdmin: false,
            orgRole: null,
            orgIds: [],
            dojos: [],
            activeDojo: null,
            capabilityOverrides: {},
            profiles: [],
            activeProfile: '',
        }),
        activeDojo,
        org,
        role,
        /** El rol de sede lo hereda de la marca: da lectura, no escritura. */
        roleInherited,
        orgRole,
        caps,
        allows,
        branding,
        features,
        can,
        switchDojo,
        switchProfile,
        isStaff: isStaff(role),
        isManager: isManager(role),
        billing: activeDojo?.billing ?? null,
        timezone: activeDojo?.timezone ?? 'America/Argentina/Buenos_Aires',

        /** Cobro online: plan de la organización Y toggle de esta sede. */
        mercadoPago: mercadoPagoEnabled(
            org?.plan ?? 'basic',
            org?.features ?? {},
            (activeDojo?.billing as { mercadopago_enabled?: boolean } | undefined)?.mercadopago_enabled
        ),

        /** Sedes permitidas por el plan. `null` = sin límite. */
        dojoLimit: getDojoLimit(org?.plan ?? 'basic'),
    }
}

