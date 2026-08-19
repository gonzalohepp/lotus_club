/**
 * constants.ts — Valores compartidos por los tres runtimes.
 *
 * Vive separado de `server.ts` porque ese módulo importa `server-only` y
 * `next/headers`, que revientan si se los importa desde el middleware (Edge) o
 * desde un Client Component. Acá sólo hay constantes puras.
 */

/** Cookie donde el switcher persiste el dojo activo. */
export const ACTIVE_DOJO_COOKIE = 'active_dojo'

/** Un año: la elección de dojo sobrevive a cerrar el navegador. */
export const ACTIVE_DOJO_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Cookie del PERFIL activo: con qué sombrero entra la persona.
 *
 * Distinta de `ACTIVE_DOJO_COOKIE`, que elige la sede. Una misma persona puede
 * ser Mestre de la marca y además alumno de una sucursal; el dojo activo no
 * alcanza para desambiguar eso, porque parado en esa sucursal los dos perfiles
 * apuntan a la misma sede y a roles distintos.
 *
 * Formato del valor: `marca:<org_id>` o `sede:<dojo_id>`.
 */
export const ACTIVE_PROFILE_COOKIE = 'active_profile'

/** Prefijos del valor de la cookie de perfil. */
export const PROFILE_BRAND = 'marca'
export const PROFILE_SEDE = 'sede'

/**
 * Sede "ninguna". Se usa como valor de `dojo_id` cuando todavía no se resolvió
 * el tenant (el contexto baja del layout server-side y tarda un tick).
 *
 * Es el UUID nulo, no un string vacío: `''` no es un uuid válido y Postgres
 * corta la query con `22P02 invalid input syntax for type uuid` antes de mirar
 * ninguna fila. Con el UUID nulo la consulta es válida y simplemente no matchea
 * nada, que es exactamente lo que se quiere mientras carga.
 */
export const NO_DOJO = '00000000-0000-0000-0000-000000000000'
