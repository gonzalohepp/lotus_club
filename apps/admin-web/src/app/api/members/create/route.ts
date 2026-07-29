import { NextResponse } from 'next/server'

import { requireDojoManager } from '@/lib/tenant/server'
import { serviceClient } from '@/lib/tenant/admin'
import type { DojoRole } from '@/lib/tenant/types'

/**
 * Alta de un alumno EN LA SEDE ACTIVA.
 *
 * Cambios respecto de la versión single-tenant:
 *  · Toda fila creada lleva `dojo_id`: membresía, inscripciones a clases y la
 *    pertenencia (`dojo_members`). Sin eso las inserciones fallan, porque
 *    `dojo_id` es NOT NULL en esas tablas.
 *  · El rol va a `dojo_members.role`, no a `profiles.role`.
 *  · Si la persona YA existe (entrena en otra sede), no se le pisa el perfil:
 *    se le agrega la pertenencia a esta sede y se completan sólo los campos que
 *    estén vacíos. Ese es el caso "lunes en Lanús, viernes en Avellaneda".
 */

const VALID_ROLES: DojoRole[] = ['admin', 'instructor', 'member', 'becado']

export async function POST(req: Request) {
    const guard = await requireDojoManager()
    if (guard.error) return guard.error

    const { dojoId } = guard

    try {
        const body = await req.json()
        const {
            first_name,
            last_name,
            email,
            phone,
            emergency_phone,
            notes,
            access_code,
            last_payment_date,
            next_payment_due,
            classes,
            role,
        } = body

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const memberRole: DojoRole = VALID_ROLES.includes(role) ? role : 'member'

        const admin = serviceClient()

        let userId: string

        const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { first_name, last_name },
        })

        if (createError) {
            if (createError.message.includes('already has been registered') || createError.status === 422) {
                const { data: listData } = await admin.auth.admin.listUsers()
                const found = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
                if (found) {
                    userId = found.id
                } else {
                    throw new Error('User exists but could not be found via admin list')
                }
            } else {
                throw createError
            }
        } else {
            userId = createdUser.user.id
        }

        // El perfil es GLOBAL: si la persona ya entrena en otra sede, no le
        // pisamos nombre ni teléfono con lo que haya cargado esta. Sólo
        // completamos lo que esté vacío.
        const { data: existing } = await admin
            .from('profiles')
            .select('user_id, first_name, last_name, phone, emergency_phone')
            .eq('user_id', userId)
            .maybeSingle()

        const { error: profileError } = await admin.from('profiles').upsert(
            {
                user_id: userId,
                email,
                first_name: existing?.first_name || first_name,
                last_name: existing?.last_name || last_name,
                phone: existing?.phone || phone || null,
                emergency_phone: existing?.emergency_phone || emergency_phone || null,
            },
            { onConflict: 'user_id' }
        )

        if (profileError) {
            throw new Error('Error creating profile: ' + profileError.message)
        }

        // Pertenencia a ESTA sede. `notes` y `access_code` son por dojo.
        const { error: memberError } = await admin.from('dojo_members').upsert(
            {
                dojo_id: dojoId,
                user_id: userId,
                role: memberRole,
                is_active: true,
                notes: notes ?? null,
                access_code: access_code ?? null,
            },
            { onConflict: 'dojo_id,user_id' }
        )

        if (memberError) {
            throw new Error('Error creating dojo membership: ' + memberError.message)
        }

        const { error: memErr } = await admin.from('memberships').upsert(
            {
                dojo_id: dojoId,
                member_id: userId,
                type: 'monthly',
                start_date: last_payment_date ?? new Date().toISOString().slice(0, 10),
                end_date: next_payment_due ?? null,
            },
            { onConflict: 'dojo_id,member_id' }
        )

        if (memErr) throw new Error('Error creating membership: ' + memErr.message)

        if (classes && classes.length > 0) {
            // Las clases tienen que ser de esta sede: si no se valida, un admin
            // podría inscribir a su alumno en una clase de otro dojo pasando el
            // class_id a mano.
            const classIds = classes.map((c: { class_id: number }) => c.class_id)

            const { data: ownClasses } = await admin
                .from('classes')
                .select('id')
                .eq('dojo_id', dojoId)
                .in('id', classIds)

            const allowed = new Set((ownClasses ?? []).map((c) => c.id))
            const rejected = classIds.filter((id: number) => !allowed.has(id))

            if (rejected.length > 0) {
                return NextResponse.json(
                    { error: 'Alguna de las clases seleccionadas no pertenece a esta sede' },
                    { status: 400 }
                )
            }

            const { error: classErr } = await admin.from('class_enrollments').upsert(
                classes.map((c: { class_id: number; is_principal: boolean }) => ({
                    dojo_id: dojoId,
                    user_id: userId,
                    class_id: c.class_id,
                    is_principal: c.is_principal,
                })),
                { onConflict: 'dojo_id,user_id,class_id' }
            )

            if (classErr) throw new Error('Error enrolling classes: ' + classErr.message)
        }

        return NextResponse.json({ ok: true, userId })
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error('Create Member Error:', e)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
