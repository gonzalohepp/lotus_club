'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { TenantProvider } from '@/lib/tenant/context'
import BrandStyle from '@/components/tenant/BrandStyle'
import type { TenantContext } from '@/lib/tenant/types'

/**
 * El tenant se resuelve UNA vez en el layout server-side y se inyecta acá, para
 * que ningún componente de cliente tenga que volver a preguntar por su dojo,
 * su rol o el plan de su organización.
 *
 * `tenant` es null en las rutas públicas (landing, login): no hay sesión.
 */
export function Providers({ children, tenant }: { children: React.ReactNode; tenant?: TenantContext | null }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000, // 1 minute
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            <TenantProvider value={tenant ?? null}>
                {/* Sobreescribe las variables --brand con los colores de la
                    organización activa. Va adentro del provider porque las lee
                    del contexto. */}
                <BrandStyle />
                {children}
            </TenantProvider>
        </QueryClientProvider>
    )
}
