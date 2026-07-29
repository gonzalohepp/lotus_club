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
 * Sede "ninguna". Se usa como valor de `dojo_id` cuando todavía no se resolvió
 * el tenant (el contexto baja del layout server-side y tarda un tick).
 *
 * Es el UUID nulo, no un string vacío: `''` no es un uuid válido y Postgres
 * corta la query con `22P02 invalid input syntax for type uuid` antes de mirar
 * ninguna fila. Con el UUID nulo la consulta es válida y simplemente no matchea
 * nada, que es exactamente lo que se quiere mientras carga.
 */
export const NO_DOJO = '00000000-0000-0000-0000-000000000000'
