import { NextResponse } from 'next/server'

import { requireDojoManager } from '@/lib/tenant/server'
import { assertMemberOfDojo, isLastAdmin, isPlatformAdmin, serviceClient } from '@/lib/tenant/admin'
import type { DojoRole } from '@/lib/tenant/types'

/**
 * Edición de un alumno DENTRO de la sede activa.
 *
 * Dos cambios respecto de la versión single-tenant:
 *
 *  1. El `user_id` que llega del cliente se valida contra el dojo activo antes
 *     de tocarlo. Antes no: con service role (que ignora RLS), un dueño de sede
 *     podía editar el perfil de cualquier persona de la plataforma mandando su
 *     user_id a mano.
 *
 *  2. El rol se escribe en `dojo_members.role` (rol POR DOJO), no en
 *     `profiles.role` (el rol global heredado). Escribir el global significaba
 *     que ascender a alguien a admin en Lanús lo ascendía también en Avellaneda.
 */

const VALID_ROLES: DojoRole[] = ['admin', 'instructor', 'member', 'becado']

export async function POST(req: Request) {
  const guard = await requireDojoManager()
  if (guard.error) return guard.error

  const { dojoId, ctx } = guard

  try {
    const body = await req.json()
    const {
      user_id,
      first_name,
      last_name,
      email,
      phone,
      emergency_phone,
      notes,
      access_code,
      role,
    } = body ?? {}

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const admin = serviceClient()

    // (1) La persona tiene que pertenecer a ESTA sede.
    const target = await assertMemberOfDojo(admin, dojoId, user_id)
    if ('error' in target) return target.error

    // (2) El dueño de la plataforma no se toca desde el panel de una sede.
    if (user_id !== ctx.userId && (await isPlatformAdmin(admin, user_id))) {
      return NextResponse.json(
        { error: 'No podés editar a un administrador de la plataforma' },
        { status: 403 }
      )
    }

    // Datos personales: son globales (una persona, un perfil), y sólo los edita
    // quien comparte sede con ella — que es lo que acabamos de verificar.
    const { error } = await admin
      .from('profiles')
      .update({
        first_name: first_name ?? null,
        last_name: last_name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        emergency_phone: emergency_phone ?? null,
      })
      .eq('user_id', user_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Lo que sí es por sede: rol, notas internas y código de acceso.
    const membershipPatch: Record<string, unknown> = {
      notes: notes ?? null,
      access_code: access_code ?? null,
    }

    if (role && role !== target.role) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
      }
      if (role !== 'admin' && (await isLastAdmin(admin, dojoId, user_id))) {
        return NextResponse.json(
          { error: 'Es el único administrador de la sede. Asigná otro antes de cambiarle el rol.' },
          { status: 409 }
        )
      }
      membershipPatch.role = role
    }

    const { error: memberError } = await admin
      .from('dojo_members')
      .update(membershipPatch)
      .eq('dojo_id', dojoId)
      .eq('user_id', user_id)

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
