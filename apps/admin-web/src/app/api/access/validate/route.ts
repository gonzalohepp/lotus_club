import { NextResponse } from 'next/server'

import { requireDojo } from '@/lib/tenant/server'
import { serviceClient } from '@/lib/tenant/admin'
import { nowAR_ISO, todayAR } from '@/lib/dateUtils'

/**
 * Validación de acceso — decide en el SERVIDOR si alguien entra.
 *
 * ⚠️ Antes esta lógica vivía entera en `/validate`, es decir en el navegador del
 * alumno, que además insertaba el registro de ingreso directamente en
 * `access_logs`. Con eso, cualquiera con la consola abierta podía marcarse
 * "autorizado" sin escanear nada y con la cuota vencida: la decisión la tomaba
 * su propio browser.
 *
 * Ahora el cliente sólo manda el token escaneado. El servidor:
 *   1. Verifica que el token exista, sea de esta sede y no esté vencido.
 *   2. Busca al alumno EN ESTA SEDE y evalúa su estado de cuota.
 *   3. Aplica el cooldown anti doble-scan.
 *   4. Arma las clases candidatas según el día y la hora.
 *   5. Registra el rechazo, o deja el ingreso pendiente de elegir clase.
 *
 * El alumno ya no tiene INSERT sobre `access_logs` (ver migración
 * 20260729100000): la única vía para registrar un ingreso es este endpoint.
 */

const DAY_MAP = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

/** Tolerancia después de que termina la clase, para el que llega tarde. */
const LATE_TOLERANCE_MIN = 20

/** Ventana en la que un segundo escaneo se considera repetido. */
const COOLDOWN_MIN = 2

type ClassRow = {
    id: number
    name: string
    instructor: string | null
    color: string | null
    days: string[] | null
    start_time: string | null
    end_time: string | null
    price_principal: number | null
    price_additional: number | null
}

function minutesOf(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + (m || 0)
}

export async function POST(req: Request) {
    const guard = await requireDojo()
    if (guard.error) return guard.error

    const { ctx, dojoId } = guard
    const admin = serviceClient()

    const body = await req.json().catch(() => null)
    const token: string | undefined = body?.token

    /** Registra el intento y arma la respuesta de rechazo. */
    const deny = async (reason: string) => {
        await admin.from('access_logs').insert({
            dojo_id: dojoId,
            user_id: ctx.userId,
            result: 'denegado',
            reason,
            scanned_at: nowAR_ISO(),
        })
        return NextResponse.json({ allowed: false, reason })
    }

    if (!token) {
        return NextResponse.json({ error: 'Falta el token del QR' }, { status: 400 })
    }

    // 1. El token tiene que ser de ESTA sede y estar vigente.
    const { data: dbToken } = await admin
        .from('qr_tokens')
        .select('id')
        .eq('dojo_id', dojoId)
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

    if (!dbToken) {
        return await deny('El código QR expiró o no es de esta sede')
    }

    // 2. Estado del alumno en esta sede. `members_with_status` ya trae el
    //    resultado del motor de cobro, así que no se recalcula nada acá.
    const { data: member } = await admin
        .from('members_with_status')
        .select('user_id, first_name, last_name, email, role, status, phase, blocks_access, tier_label, amount_due, next_payment_due, is_new_member')
        .eq('dojo_id', dojoId)
        .eq('user_id', ctx.userId)
        .maybeSingle()

    if (!member) {
        return await deny('No estás dado de alta en esta sede')
    }

    if (member.blocks_access) {
        return await deny(
            member.phase === 'bloqueado'
                ? `Acceso bloqueado — ${member.tier_label ?? 'cuota vencida'}`
                : 'Cuota vencida'
        )
    }

    if (member.status !== 'activo') {
        return await deny('Membresía inactiva o suspendida')
    }

    // 3. Cooldown: evita contar dos veces el mismo ingreso.
    const desde = new Date(Date.now() - COOLDOWN_MIN * 60 * 1000).toISOString()
    const { data: reciente } = await admin
        .from('access_logs')
        .select('id')
        .eq('dojo_id', dojoId)
        .eq('user_id', ctx.userId)
        .eq('result', 'autorizado')
        .gt('scanned_at', desde)
        .limit(1)

    if (reciente?.length) {
        return NextResponse.json({
            allowed: false,
            alreadyIn: true,
            reason: `Ya registramos tu ingreso hace menos de ${COOLDOWN_MIN} minutos`,
        })
    }

    // 4. Clases candidatas: las que tiene inscritas HOY y todavía no terminaron.
    const { data: enrollments } = await admin
        .from('class_enrollments')
        .select('is_principal, classes:class_id ( id, name, instructor, color, days, start_time, end_time, price_principal, price_additional )')
        .eq('dojo_id', dojoId)
        .eq('user_id', ctx.userId)

    const todas = (enrollments ?? [])
        .map((e) => {
            const c = e.classes as unknown as ClassRow | null
            return c ? { ...c, is_principal: e.is_principal } : null
        })
        .filter((c): c is ClassRow & { is_principal: boolean } => c !== null)

    const ahora = new Date(
        new Date().toLocaleString('en-US', { timeZone: ctx.activeDojo?.timezone ?? 'America/Argentina/Buenos_Aires' })
    )
    const diaHoy = DAY_MAP[ahora.getDay()]
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()

    const deHoy = todas.filter((c) => {
        if (!c.days?.length || !c.end_time) return false
        // Los días se guardan sin tilde y en minúscula ("miercoles").
        if (!c.days.some((d) => d.toLowerCase().startsWith(diaHoy.slice(0, 3)))) return false
        return minutosAhora <= minutesOf(c.end_time) + LATE_TOLERANCE_MIN
    })

    // Si no hay ninguna de hoy se ofrecen todas: puede haber venido a suplir
    // una clase o el horario puede estar mal cargado, y negarle el ingreso a un
    // alumno al día por un dato de agenda sería peor.
    const candidatas = deHoy.length > 0 ? deHoy : todas

    // 5. Sin clases inscritas no hay nada que elegir: se registra y entra.
    if (candidatas.length === 0) {
        await admin.from('access_logs').insert({
            dojo_id: dojoId,
            user_id: ctx.userId,
            result: 'autorizado',
            reason: 'Acceso autorizado',
            scanned_at: nowAR_ISO(),
        })

        return NextResponse.json({
            allowed: true,
            reason: '¡Bienvenido!',
            member,
            classes: [],
            checkedIn: true,
        })
    }

    return NextResponse.json({
        allowed: true,
        reason: '¡Bienvenido!',
        member,
        classes: candidatas,
        // El ingreso todavía NO está registrado: falta que elija la clase y
        // confirme contra /api/access/checkin.
        checkedIn: false,
        today: todayAR(),
    })
}
