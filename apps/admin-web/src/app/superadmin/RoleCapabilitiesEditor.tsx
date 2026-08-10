'use client'

import { useEffect, useState } from 'react'
import { Loader2, RotateCcw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import {
    EDITABLE_CAPABILITIES,
    type EditableCapability,
} from '@/lib/tenant/types'

/**
 * Matriz de permisos por rol de una organización.
 *
 * Sólo aparecen las capacidades DELEGABLES. Las de plataforma —consola, alta de
 * sedes, alta de superadmins y reglas de cobro— no están, y no es sólo que no
 * se muestren: el CHECK de `role_capabilities` las rechaza, y su RLS sólo deja
 * escribir al desarrollador. Si un superadmin pudiera editarlas se autoasignaría
 * las reglas de recargo y bloqueo de sus propios alumnos.
 *
 * Una celda sin fila usa el DEFAULT del código. Por eso se muestran tres
 * estados: heredado, forzado en sí, forzado en no.
 */

const ROLES = [
    { key: 'superadmin', label: 'Mestre', hint: 'Todas las sedes, incluida la plata' },
    { key: 'head_coach', label: 'Coordinador regional', hint: 'Todas las sedes, sin finanzas' },
    { key: 'admin', label: 'Responsable de academia', hint: 'Su sede, completo' },
    { key: 'instructor', label: 'Profesor / Instructor', hint: 'Alumnos y asistencia' },
    { key: 'member', label: 'Alumno', hint: 'Sólo lo propio' },
] as const

const CAP_LABEL: Record<EditableCapability, { label: string; hint: string }> = {
    viewDojos: { label: 'Ver sedes', hint: 'La sección "Academias"' },
    manageDojoSettings: { label: 'Configurar sede', hint: 'Datos, equipo y marca' },
    manageMembers: { label: 'Gestionar alumnos', hint: 'Alta, edición y clases' },
    viewFinance: { label: 'Ver finanzas', hint: 'Pagos, métricas y recaudación' },
}

/**
 * Defaults del código. Tienen que coincidir con `default_capability()` en la base.
 *
 * `manageMembers` es false para los roles de MARCA: ven el padrón y las clases
 * de todas sus sedes, pero no las escriben. Lo escribe el responsable de la
 * academia, que tiene su fila en `dojo_members`. Ver `can_manage_roster()`.
 */
const DEFAULTS: Record<string, Record<EditableCapability, boolean>> = {
    superadmin: { viewDojos: true, manageDojoSettings: true, manageMembers: false, viewFinance: true },
    head_coach: { viewDojos: true, manageDojoSettings: true, manageMembers: false, viewFinance: false },
    manager: { viewDojos: false, manageDojoSettings: false, manageMembers: false, viewFinance: false },
    admin: { viewDojos: false, manageDojoSettings: false, manageMembers: true, viewFinance: true },
    instructor: { viewDojos: false, manageDojoSettings: false, manageMembers: false, viewFinance: false },
    member: { viewDojos: false, manageDojoSettings: false, manageMembers: false, viewFinance: false },
    becado: { viewDojos: false, manageDojoSettings: false, manageMembers: false, viewFinance: false },
}

type Overrides = Record<string, Partial<Record<EditableCapability, boolean>>>

export default function RoleCapabilitiesEditor({ orgId }: { orgId: string }) {
    const [overrides, setOverrides] = useState<Overrides>({})
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<string | null>(null)

    useEffect(() => {
        supabase
            .from('role_capabilities')
            .select('role, capability, enabled')
            .eq('org_id', orgId)
            .then(({ data, error }) => {
                setLoading(false)
                if (error) { toast.error('No se pudieron cargar los permisos'); return }
                const next: Overrides = {}
                for (const r of data ?? []) {
                    const role = r.role as string
                    next[role] = { ...(next[role] ?? {}), [r.capability as EditableCapability]: r.enabled }
                }
                setOverrides(next)
            })
    }, [orgId])

    const effective = (role: string, cap: EditableCapability) =>
        overrides[role]?.[cap] ?? DEFAULTS[role]?.[cap] ?? false

    const isOverridden = (role: string, cap: EditableCapability) =>
        typeof overrides[role]?.[cap] === 'boolean'

    const setCell = async (role: string, cap: EditableCapability, value: boolean | null) => {
        const cellId = `${role}:${cap}`
        setBusy(cellId)

        if (value === null) {
            const { error } = await supabase
                .from('role_capabilities')
                .delete()
                .eq('org_id', orgId).eq('role', role).eq('capability', cap)
            setBusy(null)
            if (error) { toast.error(error.message); return }
            setOverrides(prev => {
                const next = { ...prev, [role]: { ...prev[role] } }
                delete next[role][cap]
                return next
            })
            toast.success('Vuelve al valor por defecto')
            return
        }

        const { error } = await supabase
            .from('role_capabilities')
            .upsert(
                { org_id: orgId, role, capability: cap, enabled: value },
                { onConflict: 'org_id,role,capability' }
            )
        setBusy(null)
        if (error) { toast.error(error.message); return }
        setOverrides(prev => ({ ...prev, [role]: { ...prev[role], [cap]: value } }))
        toast.success('Guardado. Aplica al recargar la sesión de esa persona.')
    }

    if (loading) {
        return <p className="flex items-center gap-2 text-sm text-carbon-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando permisos…</p>
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr>
                            <th className="text-left p-2 text-[10px] font-black uppercase tracking-widest text-carbon-400">Rol</th>
                            {EDITABLE_CAPABILITIES.map(c => (
                                <th key={c} className="p-2 text-center">
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-carbon-400">
                                        {CAP_LABEL[c].label}
                                    </span>
                                    <span className="block text-[10px] font-normal normal-case text-carbon-400/70">
                                        {CAP_LABEL[c].hint}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ROLES.map(r => (
                            <tr key={r.key} className="border-t border-carbon-200 dark:border-white/10">
                                <td className="p-2">
                                    <span className="block font-bold">{r.label}</span>
                                    <span className="block text-[11px] text-carbon-500">{r.hint}</span>
                                </td>
                                {EDITABLE_CAPABILITIES.map(c => {
                                    const on = effective(r.key, c)
                                    const forced = isOverridden(r.key, c)
                                    const cellId = `${r.key}:${c}`
                                    return (
                                        <td key={c} className="p-2 text-center">
                                            <button
                                                disabled={busy === cellId}
                                                onClick={() => setCell(r.key, c, !on)}
                                                title={forced ? 'Forzado. Click para invertir' : 'Valor por defecto. Click para forzar'}
                                                className={`w-16 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-40 ${
                                                    on
                                                        ? 'bg-[#899878] text-[#121113]'
                                                        : 'bg-carbon-200 text-carbon-600 dark:bg-white/10 dark:text-carbon-300'
                                                }`}
                                            >
                                                {busy === cellId ? '…' : on ? 'Sí' : 'No'}
                                            </button>
                                            {forced && (
                                                <button
                                                    onClick={() => setCell(r.key, c, null)}
                                                    title="Volver al valor por defecto"
                                                    className="mt-1 mx-auto flex items-center gap-1 text-[10px] text-carbon-400 hover:text-carbon-600"
                                                >
                                                    <RotateCcw className="w-2.5 h-2.5" /> forzado
                                                </button>
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-3 rounded-xl border border-carbon-200 dark:border-white/10 p-4">
                <ShieldCheck className="w-5 h-5 shrink-0 text-[#5F6E50] dark:text-[#899878]" />
                <div className="text-xs text-carbon-500 dark:text-carbon-400 space-y-1">
                    <p>
                        <strong className="text-carbon-900 dark:text-white">Estos permisos mandan también en la base</strong>, no
                        sólo en el menú: &quot;Ver finanzas&quot; se aplica en la RLS de pagos, así que
                        destildarlo le corta los datos aunque pegue contra la API.
                    </p>
                    <p>
                        La consola de plataforma, el alta de sedes y las reglas de cobro <strong>no
                        figuran acá</strong> a propósito: son de la plataforma y no se delegan.
                    </p>
                    <p>El cambio aplica cuando la persona recarga su sesión.</p>
                </div>
            </div>
        </div>
    )
}
