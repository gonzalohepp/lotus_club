import { redirect } from 'next/navigation'

import { getServerSupabase, getTenantContext } from '@/lib/tenant/server'
import type { Dojo, Organization } from '@/lib/tenant/types'

import Console from './Console'

/**
 * /superadmin — Consola de plataforma.
 *
 * Es la UI para vos como dev: dar de alta organizaciones y sedes, cambiar
 * plan Basic/Pro, colores, logo y la lógica de cobro de cada dojo, sin editar
 * código ni correr SQL a mano.
 *
 * Acceso: sólo usuarios en `platform_admins`. El middleware ya reescribe a 404
 * a cualquier otro; esta comprobación es la segunda barrera (defensa en
 * profundidad: si alguien deshabilita el matcher del middleware, esto sigue).
 */
export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
    const ctx = await getTenantContext()

    if (!ctx) redirect('/login')
    if (!ctx.isPlatformAdmin) redirect('/admin')

    const supabase = await getServerSupabase()

    // RLS ya le da acceso total al platform admin, así que alcanza con el
    // cliente normal — no hace falta la service role key.
    const [{ data: orgs }, { data: dojos }, { data: counts }] = await Promise.all([
        supabase.from('organizations').select('*').order('name'),
        supabase.from('dojos').select('*').order('name'),
        supabase.from('dojo_members').select('dojo_id').eq('is_active', true),
    ])

    // Alumnos por dojo, para mostrar el tamaño de cada sede en la lista.
    const memberCounts = (counts ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.dojo_id] = (acc[row.dojo_id] ?? 0) + 1
        return acc
    }, {})

    return (
        <Console
            orgs={(orgs ?? []) as Organization[]}
            dojos={(dojos ?? []) as Dojo[]}
            memberCounts={memberCounts}
        />
    )
}
