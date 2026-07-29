/**
 * dateUtils.ts — Utilidades de fecha forzando zona horaria Argentina (UTC-3)
 *
 * Todas las funciones devuelven fechas en horario de Buenos Aires,
 * independientemente de la zona horaria del dispositivo del usuario.
 */

const TZ = 'America/Argentina/Buenos_Aires'

/**
 * Devuelve la fecha actual en Argentina como string YYYY-MM-DD.
 * Usa esto para guardar `class_attendance.date`, `memberships.start_date`, etc.
 */
export function todayAR(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: TZ })
}

/**
 * Devuelve un ISO timestamp ajustado a Argentina.
 * Usa esto para guardar `access_logs.scanned_at`, `notifications.sent_at`, etc.
 */
export function nowAR_ISO(): string {
    // Construimos la fecha en zona ART y la devolvemos como ISO string
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(new Date())

    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
    const iso = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-03:00`
    return iso
}

