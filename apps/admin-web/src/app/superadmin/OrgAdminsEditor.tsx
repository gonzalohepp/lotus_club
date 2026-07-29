'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import type { OrgRole } from '@/lib/tenant/types'

/**
 * OrgAdminsEditor — Superadmins de una organización.
 *
 * Sólo aparece en la consola de plataforma, porque nombrar superadmins es del
 * desarrollador: si un superadmin pudiera nombrar a otro, el control de la
 * cuenta se propagaría sin autorización de la plataforma y darle de baja a
 * alguien no alcanzaría si ya nombró a un tercero.
 */

type OrgAdmin = {
    id: string
    user_id: string
    role: OrgRole
    is_active: boolean
    created_at: string
    profiles: {
        email: string | null
        first_name: string | null
        last_name: string | null
    } | null
}

const ROLE_LABELS: Record<OrgRole, string> = {
    superadmin: 'Superadmin',
    manager: 'Staff de marca',
}

const ROLE_HINTS: Record<OrgRole, string> = {
    superadmin: 'Ve y administra todas las sedes de la marca, y da de alta nuevas',
    manager: 'Ve todas las sedes de la marca, sin crearlas ni borrarlas',
}

export default function OrgAdminsEditor({ orgId, orgName }: { orgId: string; orgName: string }) {
    const [admins, setAdmins] = useState<OrgAdmin[]>([])
    const [loading, setLoading] = useState(true)
    const [email, setEmail] = useState('')
    const [role, setRole] = useState<OrgRole>('superadmin')
    const [adding, setAdding] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch(`/api/superadmin/org-admins?org_id=${orgId}`)
        const json = await res.json()
        setLoading(false)

        if (!res.ok) return toast.error(json.error ?? 'No se pudo cargar')
        setAdmins(json.admins)
    }, [orgId])

    useEffect(() => {
        load()
    }, [load])

    const add = async () => {
        if (!email.trim()) return

        setAdding(true)
        const res = await fetch('/api/superadmin/org-admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: orgId, email, role }),
        })
        const json = await res.json()
        setAdding(false)

        if (!res.ok) return toast.error(json.error ?? 'No se pudo agregar', { duration: 6000 })

        toast.success(`${email} ahora es ${ROLE_LABELS[role].toLowerCase()} de ${orgName}`)
        setEmail('')
        load()
    }

    const remove = async (admin: OrgAdmin) => {
        const label = admin.profiles?.email ?? 'este usuario'
        if (!confirm(`¿Quitarle el rol de ${ROLE_LABELS[admin.role].toLowerCase()} a ${label}?`)) return

        const res = await fetch(`/api/superadmin/org-admins?id=${admin.id}`, { method: 'DELETE' })
        const json = await res.json()

        if (!res.ok) return toast.error(json.error ?? 'No se pudo quitar')

        toast.success('Rol quitado')
        load()
    }

    return (
        <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row gap-3 md:items-end">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            placeholder="persona@gmail.com"
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && add()}
                            className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                        />
                    </div>

                    <div className="md:w-52">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Rol
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as OrgRole)}
                            className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                        >
                            {(Object.keys(ROLE_LABELS) as OrgRole[]).map((r) => (
                                <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={add}
                        disabled={adding || !email.trim()}
                        className="flex items-center justify-center gap-2 px-5 h-10 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        Agregar
                    </button>
                </div>

                <p className="mt-2 text-xs text-slate-500">{ROLE_HINTS[role]}</p>
                <p className="mt-1 text-xs text-slate-400">
                    La persona tiene que haber entrado al menos una vez con Google. No se pueden crear cuentas ajenas.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                </div>
            ) : admins.length === 0 ? (
                <p className="text-sm text-slate-400">
                    Esta organización todavía no tiene superadmins. Sin uno, sólo vos podés administrarla.
                </p>
            ) : (
                <div className="space-y-2">
                    {admins.map((a) => {
                        const name =
                            [a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(' ') ||
                            a.profiles?.email ||
                            'Sin nombre'

                        return (
                            <div
                                key={a.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40"
                            >
                                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{name}</p>
                                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        {a.profiles?.email}
                                    </p>
                                </div>

                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">
                                    {ROLE_LABELS[a.role]}
                                </span>

                                <button
                                    onClick={() => remove(a)}
                                    className="p-2 rounded-lg text-slate-400 hover:text-red-500"
                                    aria-label="Quitar rol"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
