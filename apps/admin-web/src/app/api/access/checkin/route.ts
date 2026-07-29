import { NextResponse } from 'next/server'

import { requireDojo } from '@/lib/tenant/server'
import { serviceClient } from '@/lib/tenant/admin'
import { nowAR_ISO, todayAR } from '@/lib/dateUtils'

/**
 * Confirma el ingreso una vez que el alumno eligió a qué clase viene.
 *
 * Segundo paso de `/api/access/validate`. Vuelve a verificar TODO en el
 * servidor en vez de confiar en que el paso anterior salió bien: entre una
 * llamada y la otra el cliente podría saltearse el scan y llamar directo acá.
 *
 * Las clases recibidas se validan contra las inscripciones reales del alumno en
 * esta sede — si no, alguien podría marcarse presente en una clase a la que no
 * está anotado, o de otra sucursal.
 */
export async function POST(req: Request) {
    const guard = await requireDojo()
    if (guard.error) return guard.error

    const { ctx, dojoId } = guard
    const admin = serviceClient()

    const body = await req.json().catch(() => null)
    const classIds: number[] = Array.isArray(body?.class_ids)
        ? body.class_ids.map(Number).filter(Number.isFinite)
        : []

    // 1. El estado de cuota se re-evalúa: no alcanza con que hace 5 segundos
    //    estuviera al día.
    const { data: member } = await admin
        .from('members_with_status')
        .select('user_id, status, blocks_access, tier_label')
        .eq('dojo_id', dojoId)
        .eq('user_id', ctx.userId)
        .maybeSingle()

    if (!member) {
        return NextResponse.json({ error: 'No estás dado de alta en esta sede' }, { status: 403 })
    }

    if (member.blocks_access || member.status !== 'activo') {
        await admin.from('access_logs').insert({
            dojo_id: dojoId,
            user_id: ctx.userId,
            result: 'denegado',
            reason: member.tier_label ?? 'Cuota vencida',
            scanned_at: nowAR_ISO(),
        })
        return NextResponse.json({ allowed: false, reason: 'Cuota vencida' }, { status: 403 })
    }

    // 2. Las clases tienen que ser suyas y de esta sede.
    if (classIds.length > 0) {
        const { data: propias } = await admin
            .from('class_enrollments')
            .select('class_id')
            .eq('dojo_id', dojoId)
            .eq('user_id', ctx.userId)
            .in('class_id', classIds)

        const permitidas = new Set((propias ?? []).map((e) => e.class_id))
        const ajenas = classIds.filter((id) => !permitidas.has(id))

        if (ajenas.length > 0) {
            return NextResponse.json(
                { error: 'No estás inscripto en alguna de esas clases' },
                { status: 403 }
            )
        }

        const hoy = todayAR()

        const { error: attErr } = await admin.from('class_attendance').upsert(
            classIds.map((id) => ({
                dojo_id: dojoId,
                user_id: ctx.userId,
                class_id: id,
                date: hoy,
            })),
            // La constraint existente es (user_id, class_id, date). No incluye
            // dojo_id y no hace falta: una clase pertenece a una sola sede, así
            // que el class_id ya determina el dojo.
            { onConflict: 'user_id,class_id,date', ignoreDuplicates: true }
        )

        // La asistencia es un dato de gestión: si falla, se registra el problema
        // pero no se le niega la entrada a alguien que está al día.
        if (attErr) {
            console.error('[checkin] no se pudo registrar la asistencia:', attErr.message)
        }
    }

    const { error: logErr } = await admin.from('access_logs').insert({
        dojo_id: dojoId,
        user_id: ctx.userId,
        result: 'autorizado',
        reason: 'Acceso autorizado',
        scanned_at: nowAR_ISO(),
    })

    if (logErr) {
        return NextResponse.json({ error: logErr.message }, { status: 500 })
    }

    return NextResponse.json({ allowed: true, reason: '¡Bienvenido!' })
}
