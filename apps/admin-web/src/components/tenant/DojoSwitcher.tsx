'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, ShieldCheck } from 'lucide-react'

import { useTenant } from '@/lib/tenant/context'

/**
 * DojoSwitcher — Selector de sede activa.
 *
 * Es la pieza de UI que hace visible el multi-tenant. Se muestra sólo si la
 * persona pertenece a más de un dojo: un admin de una sola sede no necesita
 * elegir nada y no debería ver ruido de más.
 *
 * Al cambiar de dojo se persiste la elección en cookie y se recarga, para que
 * el layout server-side vuelva a resolver rol, plan y branding del dojo nuevo.
 */
export default function DojoSwitcher() {
    const { dojos, activeDojo, switchDojo, isPlatformAdmin, orgRole } = useTenant()
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    // Cerrar al hacer click afuera.
    useEffect(() => {
        if (!open) return

        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [open])

    // Una sola sede: no hay nada que elegir.
    if (!activeDojo || dojos.length <= 1) {
        return activeDojo ? (
            <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-carbon-100 dark:bg-carbon-800/60">
                <Building2 className="w-4 h-4 text-carbon-400 shrink-0" />
                <span className="text-sm font-bold truncate">{activeDojo.name}</span>
            </div>
        ) : null
    }

    // Agrupamos por organización: con 20 dojos de 3 marcas distintas, una lista
    // plana es inusable.
    type DojoEntry = (typeof dojos)[number]

    const byOrg = dojos.reduce<Record<string, DojoEntry[]>>((acc, d) => {
        ;(acc[d.org.name] ??= []).push(d)
        return acc
    }, {})

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 px-3 h-10 rounded-xl bg-carbon-100 dark:bg-carbon-800/60 hover:bg-carbon-200 dark:hover:bg-carbon-700/60 transition-colors max-w-[240px]"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <Building2 className="w-4 h-4 text-carbon-400 shrink-0" />
                <span className="text-sm font-bold truncate">{activeDojo.name}</span>
                <ChevronDown
                    className={`w-4 h-4 text-carbon-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div
                    role="listbox"
                    className="absolute left-0 top-12 z-50 w-72 max-h-[70vh] overflow-y-auto rounded-2xl border border-carbon-200 dark:border-carbon-700 bg-white dark:bg-carbon-900 shadow-2xl py-2"
                >
                    {(isPlatformAdmin || orgRole) && (
                        <div className="flex items-center gap-2 px-4 py-2 mb-1 text-[10px] font-black uppercase tracking-widest text-warn-600 dark:text-warn-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {isPlatformAdmin ? 'Desarrollador — ves todas las marcas' : 'Superadmin — ves todas tus sedes'}
                        </div>
                    )}

                    {Object.entries(byOrg).map(([orgName, orgDojos]) => (
                        <div key={orgName}>
                            <div className="px-4 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-carbon-400">
                                {orgName}
                            </div>

                            {orgDojos.map((d) => {
                                const isActive = d.id === activeDojo.id
                                return (
                                    <button
                                        key={d.id}
                                        role="option"
                                        aria-selected={isActive}
                                        onClick={() => {
                                            setOpen(false)
                                            if (!isActive) switchDojo(d.id)
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                            isActive
                                                ? 'bg-carbon-100 dark:bg-carbon-800'
                                                : 'hover:bg-carbon-50 dark:hover:bg-carbon-800/50'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold truncate">{d.name}</p>
                                            <p className="text-xs text-carbon-400 truncate">
                                                {d.city ? `${d.city} · ` : ''}
                                                {ROLE_LABELS[d.role] ?? d.role}
                                            </p>
                                        </div>
                                        {isActive && <Check className="w-4 h-4 text-kuro-500 shrink-0" />}
                                    </button>
                                )
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    instructor: 'Profesor',
    member: 'Alumno',
    becado: 'Becado',
}
