'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, GraduationCap, Loader2, Users } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { nowAR_ISO } from '@/lib/dateUtils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import StyledSelect from '../common/StyledSelect'

/**
 * Alta de un ingreso de invitado.
 *
 * Antes esto era un único botón que grababa `user_id: null, reason: 'Acceso
 * invitado manual'`: no quedaba quién entró ni quién lo autorizó. Ahora
 * distingue los dos casos reales y deja trazabilidad:
 *
 *   trial    alumno por primera vez → clase gratis de prueba, se escribe el nombre
 *   visitor  alumno de otra sede de la marca → se elige la sede y la persona
 *
 * En los dos casos se guarda `authorized_by` con quien habilitó el ingreso.
 */

type Step = 'kind' | 'trial' | 'visitor' | 'done'
type DojoOption = { id: string; name: string }
type MemberOption = { user_id: string; full_name: string }

export default function GuestAccessDialog({
  open,
  onOpenChange,
  dojoId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  dojoId: string | undefined
}) {
  const [step, setStep] = useState<Step>('kind')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // trial
  const [trialName, setTrialName] = useState('')

  // visitor
  const [dojos, setDojos] = useState<DojoOption[]>([])
  const [originDojo, setOriginDojo] = useState('')
  const [members, setMembers] = useState<MemberOption[]>([])
  const [memberId, setMemberId] = useState('')
  const [loadingMembers, setLoadingMembers] = useState(false)

  const reset = useCallback(() => {
    setStep('kind'); setTrialName(''); setOriginDojo(''); setMemberId('')
    setMembers([]); setError(null); setSaving(false)
  }, [])

  // Limpiar al cerrar, no dentro de un effect que corre en cada render.
  const handleOpenChange = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  // Las sedes de la marca no salen del tenant: un instructor sólo "ve" la suya,
  // y el visitante puede venir de cualquier filial.
  useEffect(() => {
    if (step !== 'visitor' || dojos.length) return
    supabase.rpc('org_visitable_dojos').then(({ data, error }) => {
      if (error) { setError('No se pudieron cargar las sedes'); return }
      setDojos((data ?? []).filter((d: DojoOption) => d.id !== dojoId))
    })
  }, [step, dojos.length, dojoId])

  /** La carga la dispara el cambio de sede, no un effect: así no hay setState
   *  sincrónico en render y el estado queda atado a la interacción real. */
  const pickDojo = (id: string) => {
    setOriginDojo(id)
    setMemberId('')
    setMembers([])
    if (!id) return
    setLoadingMembers(true)
    supabase.rpc('org_visitable_members', { target_dojo: id }).then(({ data, error }) => {
      setLoadingMembers(false)
      if (error) { setError('No se pudieron cargar los alumnos de esa sede'); return }
      setMembers((data ?? []) as MemberOption[])
    })
  }

  const save = async () => {
    setSaving(true); setError(null)

    const { data: auth } = await supabase.auth.getUser()
    const authorizedBy = auth?.user?.id ?? null

    const isTrial = step === 'trial'
    const dojoName = dojos.find(d => d.id === originDojo)?.name ?? ''
    const memberName = members.find(m => m.user_id === memberId)?.full_name ?? ''

    // `reason` queda legible tal cual se lee en el historial de accesos.
    const reason = isTrial
      ? `${trialName.trim()} — primera vez, clase gratis de prueba`
      : `${dojoName} · ${memberName} — visita`

    const { error: insertError } = await supabase.from('access_logs').insert({
      dojo_id: dojoId,
      user_id: null,
      result: 'autorizado',
      reason,
      scanned_at: nowAR_ISO(),
      guest_kind: isTrial ? 'trial' : 'visitor',
      guest_name: isTrial ? trialName.trim() : memberName,
      guest_origin_dojo_id: isTrial ? null : originDojo,
      guest_member_id: isTrial ? null : memberId,
      authorized_by: authorizedBy,
    })

    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setStep('done')
  }

  const canSaveTrial = trialName.trim().length >= 3
  const canSaveVisitor = !!originDojo && !!memberId

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
        <div className="p-8">

          {/* ---------- Paso 1: qué tipo de invitado ---------- */}
          {step === 'kind' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-center">Habilitar invitado</DialogTitle>
                <DialogDescription className="text-center text-sm mt-2">
                  ¿Quién va a entrenar hoy?
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setStep('trial')}
                  className="w-full flex items-start gap-3 rounded-2xl border border-carbon-200 dark:border-white/10 p-4 text-left transition-colors hover:border-[#899878] hover:bg-[#899878]/5"
                >
                  <span className="rounded-xl bg-[#899878]/15 p-2 text-[#5F6E50] dark:text-[#899878]">
                    <GraduationCap className="w-5 h-5" />
                  </span>
                  <span>
                    <span className="block font-bold">Alumno por primera vez</span>
                    <span className="block text-xs text-carbon-500 dark:text-carbon-400">
                      Clase gratis de prueba
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => setStep('visitor')}
                  className="w-full flex items-start gap-3 rounded-2xl border border-carbon-200 dark:border-white/10 p-4 text-left transition-colors hover:border-[#899878] hover:bg-[#899878]/5"
                >
                  <span className="rounded-xl bg-[#899878]/15 p-2 text-[#5F6E50] dark:text-[#899878]">
                    <Users className="w-5 h-5" />
                  </span>
                  <span>
                    <span className="block font-bold">Viene de otra academia</span>
                    <span className="block text-xs text-carbon-500 dark:text-carbon-400">
                      Alumno de otra sede de la marca
                    </span>
                  </span>
                </button>
              </div>
            </>
          )}

          {/* ---------- Paso 2a: prueba ---------- */}
          {step === 'trial' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-center">Clase de prueba</DialogTitle>
                <DialogDescription className="text-center text-sm mt-2">
                  Primera clase gratis. Anotá el nombre para que quede registrado.
                </DialogDescription>
              </DialogHeader>

              <input
                autoFocus
                value={trialName}
                onChange={(e) => setTrialName(e.target.value)}
                placeholder="Nombre y apellido"
                className="mt-6 h-12 w-full rounded-xl border border-carbon-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-[#899878]"
              />

              <DialogFooter className="flex-col gap-2 sm:flex-col mt-6">
                <Button
                  onClick={save}
                  disabled={!canSaveTrial || saving}
                  className="w-full h-12 rounded-xl bg-[#899878] text-[#121113] font-bold hover:brightness-110"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Habilitar ingreso'}
                </Button>
                <Button variant="ghost" onClick={() => setStep('kind')} className="w-full h-11 rounded-xl">
                  Volver
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ---------- Paso 2b: visita ---------- */}
          {step === 'visitor' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-center">Visita de otra sede</DialogTitle>
                <DialogDescription className="text-center text-sm mt-2">
                  Elegí la academia y después el alumno.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                <StyledSelect
                  placeholder="Academia de origen"
                  value={originDojo}
                  onChange={pickDojo}
                  options={dojos.map(d => ({ value: d.id, label: d.name }))}
                />

                {originDojo && (
                  loadingMembers ? (
                    <p className="flex items-center gap-2 px-1 text-xs text-carbon-500">
                      <Loader2 className="w-3 h-3 animate-spin" /> Buscando alumnos…
                    </p>
                  ) : members.length ? (
                    <StyledSelect
                      placeholder="Alumno"
                      value={memberId}
                      onChange={setMemberId}
                      options={members.map(m => ({ value: m.user_id, label: m.full_name || 'Sin nombre' }))}
                    />
                  ) : (
                    <p className="px-1 text-xs text-carbon-500">Esa sede no tiene alumnos cargados.</p>
                  )
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col mt-6">
                <Button
                  onClick={save}
                  disabled={!canSaveVisitor || saving}
                  className="w-full h-12 rounded-xl bg-[#899878] text-[#121113] font-bold hover:brightness-110"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Habilitar ingreso'}
                </Button>
                <Button variant="ghost" onClick={() => setStep('kind')} className="w-full h-11 rounded-xl">
                  Volver
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ---------- Confirmación ---------- */}
          {step === 'done' && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#899878]/15">
                <CheckCircle2 className="h-12 w-12 text-[#5F6E50] dark:text-[#899878]" />
              </div>
              <DialogTitle className="text-2xl font-black">Ingreso habilitado</DialogTitle>
              <p className="mt-2 text-sm text-carbon-500 dark:text-carbon-400">
                Quedó registrado a tu nombre en el historial de accesos.
              </p>
              <Button
                onClick={() => handleOpenChange(false)}
                className="mt-6 w-full h-12 rounded-xl bg-[#121113] dark:bg-[#F7F7F2] text-[#F7F7F2] dark:text-[#121113] font-bold"
              >
                Cerrar
              </Button>
            </div>
          )}

          {error && <p className="mt-4 text-center text-xs font-medium text-alert-600">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
