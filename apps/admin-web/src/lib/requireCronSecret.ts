import { NextResponse } from 'next/server'

/**
 * Protege endpoints pensados para ser llamados por un cron externo o un
 * Database Webhook de Supabase (no por un usuario logueado en el admin).
 * Requiere el header `Authorization: Bearer <CRON_SECRET>`.
 */
export function requireCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET

  // Sin secreto configurado nadie puede autorizarse, así que hacia afuera es
  // indistinguible de un secreto incorrecto: se responde 401 en los dos casos.
  // Un 500 con "Server misconfigured" confirmaba que la ruta existe y filtraba
  // el estado de configuración del servidor. La causa real queda en el log,
  // que es donde la necesita quien opera.
  if (!secret) {
    console.error('[requireCronSecret] CRON_SECRET no está configurado en el servidor')
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  const header = req.headers.get('authorization')

  if (header !== `Bearer ${secret}`) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  return {}
}
