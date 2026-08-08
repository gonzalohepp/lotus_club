'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, Mail, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import type { DojoRole } from '@/lib/tenant/types'

/**
 * TeamEditor — Alta de dueños, administradores y profesores de una sede.
 *
 * Como el login es Google OAuth, no se puede "crear" la cuenta de otro. Por eso
 * hay dos estados posibles al agregar a alguien:
 *
 *   · Ya tiene cuenta  → entra al equipo al instante.
 *   · Todavía no entró → queda como invitación pendiente, y se activa sola la
 *     primera vez que esa persona entre con Google.
 *
 * La API resuelve cuál de los dos casos aplica; acá sólo se refleja el
 * resultado.
 */

type Member = {
    id: string
    user_id: string
    role: DojoRole
    is_active: boolean
    joined_at: string
    profiles: {
        email: string | null
        first_name: string | null
        last_name: string | null
        avatar_url: string | null
    } | null
}

type Invitation = {
    id: string
    email: string
    role: DojoRole
    created_at: string
}

const ROLE_LABELS: Record<DojoRole, string> = {
    admin: 'Administrador',
    instructor: 'Profesor',
    member: 'Alumno',
    becado: 'Becado',
}

const ROLE_HINTS: Record<DojoRole, string> = {
    admin: 'Gestiona el día a día, pagos y configuración',
    instructor: 'Ve alumnos y asistencia; no toca plata ni config',
    member: 'Alumno',
    becado: 'Alumno exento de cuota',
}

export default function TeamEditor({ dojoId, dojoName }: { dojoId: string; dojoName: string }) {
    const [members, setMembers] = useState<Member[]>([])
    const [invitations, setInvitations] = useState<Invitation[]>([])
    const [loading, setLoading] = useState(true)
    const [email, setEmail] = useState('')
    const [role, setRole] = useState<DojoRole>('admin')
    const [adding, setAdding] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch(`/api/superadmin/team?dojo_id=${dojoId}`)
        const json = await res.json()
        setLoading(false)

        if (!res.ok) return toast.error(json.error ?? 'No se pudo cargar el equipo')

        setMembers(json.members)
        setInvitations(json.invitations)
    }, [dojoId])

    useEffect(() => {
        load()
    }, [load])

    const add = async () => {
        if (!email.trim()) return

        setAdding(true)
        const res = await fetch('/api/superadmin/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dojo_id: dojoId, email, role }),
        })
        const json = await res.json()
        setAdding(false)

        if (!res.ok) return toast.error(json.error ?? 'No se pudo agregar')

        if (json.kind === 'invitation') {
            toast.success('Invitación creada', {
                description: `${email} va a quedar como ${ROLE_LABELS[role].toLowerCase()} de ${dojoName} la primera vez que entre con Google.`,
            })
        } else {
            toast.success(`${email} agregado como ${ROLE_LABELS[role].toLowerCase()}`)
        }

        setEmail('')
        load()
    }

    const changeRole = async (memberId: string, next: DojoRole) => {
        const res = await fetch('/api/superadmin/team', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dojo_id: dojoId, member_id: memberId, role: next }),
        })
        const json = await res.json()

        if (!res.ok) return toast.error(json.error ?? 'No se pudo cambiar el rol')

        toast.success('Rol actualizado')
        load()
    }

    const remove = async (params: string, label: string) => {
        if (!confirm(`¿Quitar a ${label} de ${dojoName}?`)) return

        const res = await fetch(`/api/superadmin/team?dojo_id=${dojoId}&${params}`, { method: 'DELETE' })
        const json = await res.json()

        if (!res.ok) return toast.error(json.error ?? 'No se pudo quitar')

        toast.success('Quitado')
        load()
    }

    const staff = members.filter((m) => ['admin', 'instructor'].includes(m.role))
    const students = members.filter((m) => ['member', 'becado'].includes(m.role))

    return (
        <div className="space-y-6">
            {/* Alta ---------------------------------------------------------- */}
            <div className="p-4 rounded-2xl border border-carbon-200 dark:border-carbon-700">
                <div className="flex flex-col md:flex-row gap-3 md:items-end">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-carbon-400 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            placeholder="persona@gmail.com"
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && add()}
                            className="w-full h-10 px-3 rounded-xl bg-carbon-50 dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 text-sm"
                        />
                    </div>

                    <div className="md:w-52">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-carbon-400 mb-1">
                            Rol
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as DojoRole)}
                            className="w-full h-10 px-3 rounded-xl bg-carbon-50 dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 text-sm"
                        >
                            {(Object.keys(ROLE_LABELS) as DojoRole[]).map((r) => (
                                <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={add}
                        disabled={adding || !email.trim()}
                        className="flex items-center justify-center gap-2 px-5 h-10 rounded-xl bg-kuro-600 text-white font-bold text-sm hover:bg-kuro-700 disabled:opacity-50 transition-colors"
                    >
                        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        Agregar
                    </button>
                </div>

                <p className="mt-2 text-xs text-carbon-500">{ROLE_HINTS[role]}</p>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-carbon-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                </div>
            ) : (
                <>
                    {/* Invitaciones pendientes ------------------------------- */}
                    {invitations.length > 0 && (
                        <section>
                            <h4 className="text-xs font-black uppercase tracking-widest text-carbon-400 mb-2">
                                Invitaciones pendientes
                            </h4>
                            <div className="space-y-2">
                                {invitations.map((inv) => (
                                    <div
                                        key={inv.id}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-warn-50 dark:bg-warn-900/10 border border-warn-200 dark:border-warn-800/40"
                                    >
                                        <Clock className="w-4 h-4 text-warn-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate">{inv.email}</p>
                                            <p className="text-xs text-warn-700 dark:text-warn-500">
                                                Va a entrar como {ROLE_LABELS[inv.role].toLowerCase()} cuando se
                                                loguee por primera vez
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => remove(`invitation_id=${inv.id}`, inv.email)}
                                            className="p-2 rounded-lg text-carbon-400 hover:text-alert-500"
                                            aria-label="Cancelar invitación"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <TeamList
                        title="Equipo"
                        rows={staff}
                        emptyHint="Todavía no hay dueños ni administradores en esta sede."
                        onChangeRole={changeRole}
                        onRemove={remove}
                    />

                    <TeamList
                        title={`Alumnos (${students.length})`}
                        rows={students}
                        emptyHint="Sin alumnos todavía."
                        onChangeRole={changeRole}
                        onRemove={remove}
                        collapsed
                    />
                </>
            )}
        </div>
    )
}

function TeamList({
    title,
    rows,
    emptyHint,
    onChangeRole,
    onRemove,
    collapsed = false,
}: {
    title: string
    rows: Member[]
    emptyHint: string
    onChangeRole: (id: string, role: DojoRole) => void
    onRemove: (params: string, label: string) => void
    collapsed?: boolean
}) {
    const [open, setOpen] = useState(!collapsed)

    return (
        <section>
            <button
                onClick={() => setOpen((v) => !v)}
                className="text-xs font-black uppercase tracking-widest text-carbon-400 mb-2 hover:text-carbon-600 dark:hover:text-carbon-300"
            >
                {title} {collapsed && (open ? '▾' : '▸')}
            </button>

            {open &&
                (rows.length === 0 ? (
                    <p className="text-sm text-carbon-400">{emptyHint}</p>
                ) : (
                    <div className="space-y-2">
                        {rows.map((m) => {
                            const name =
                                [m.profiles?.first_name, m.profiles?.last_name].filter(Boolean).join(' ') ||
                                m.profiles?.email ||
                                'Sin nombre'

                            return (
                                <div
                                    key={m.id}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-carbon-50 dark:bg-carbon-800/50 border border-carbon-200 dark:border-carbon-700"
                                >
                                    <div className="w-9 h-9 rounded-full bg-carbon-200 dark:bg-carbon-700 flex items-center justify-center shrink-0 text-xs font-black text-carbon-500">
                                        {name.slice(0, 1).toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate">{name}</p>
                                        <p className="text-xs text-carbon-400 truncate flex items-center gap-1">
                                            <Mail className="w-3 h-3" />
                                            {m.profiles?.email}
                                        </p>
                                    </div>

                                    <select
                                        value={m.role}
                                        onChange={(e) => onChangeRole(m.id, e.target.value as DojoRole)}
                                        className="h-9 px-2 rounded-lg bg-white dark:bg-carbon-900 border border-carbon-200 dark:border-carbon-700 text-xs font-bold"
                                    >
                                        {(Object.keys(ROLE_LABELS) as DojoRole[]).map((r) => (
                                            <option key={r} value={r}>
                                                {ROLE_LABELS[r]}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        onClick={() => onRemove(`member_id=${m.id}`, name)}
                                        className="p-2 rounded-lg text-carbon-400 hover:text-alert-500"
                                        aria-label="Quitar de la sede"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                ))}
        </section>
    )
}
