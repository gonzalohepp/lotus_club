import { redirect } from 'next/navigation'

import { getTenantContext } from '@/lib/tenant/server'
import { isStaff } from '@/lib/tenant/types'

/**
 * /app — Router post-login. Manda a cada persona a donde le corresponde.
 *
 * ⚠️ Antes decidía con `profiles.role`, el rol GLOBAL heredado del sistema
 * single-tenant. Eso rompía en tres casos concretos:
 *
 *   · El desarrollador y los superadmins de marca tienen `profiles.role =
 *     'member'` (se los crea el trigger de alta), así que caían en /validate
 *     como si fueran alumnos.
 *   · Un administrador de sede cuyo perfil global quedó en 'member' —el caso
 *     normal ahora, porque el rol vive en `dojo_members`— tampoco llegaba a
 *     /admin.
 *   · Alguien admin en una sede y alumno en otra recibía siempre el mismo
 *     destino, sin importar en cuál estuviera parado.
 *
 * Ahora la decisión sale del contexto de tenant: rol EN LA SEDE ACTIVA, más los
 * niveles de plataforma y de marca.
 */
export default async function HomePage() {
    const ctx = await getTenantContext()

    if (!ctx) {
        redirect('/login')
    }

    // Desarrollador o staff de marca: siempre al panel, aunque no tengan un rol
    // explícito en la sede activa.
    if (ctx.isPlatformAdmin || ctx.orgRole) {
        redirect('/admin')
    }

    // Sin ninguna sede: la cuenta existe pero todavía no la dieron de alta en
    // ningún dojo. `/validate` es la pantalla que explica esa situación.
    if (!ctx.activeDojo) {
        redirect('/validate')
    }

    redirect(isStaff(ctx.activeDojo.role) ? '/admin' : '/validate')
}
