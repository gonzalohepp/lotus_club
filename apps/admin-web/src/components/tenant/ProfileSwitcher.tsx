'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronsUpDown, Network } from 'lucide-react'

import { useTenant } from '@/lib/tenant/context'

/**
 * ProfileSwitcher — Con qué sombrero entrás.
 *
 * Lo pidió el informe de evaluación: una misma persona puede ser Mestre de la
 * red, responsable de su propia academia y alumno de otra. Antes eso obligaba a
 * tener una cuenta por rol, porque parado en una sucursal el rol explícito
 * ganaba y el de marca desaparecía.
 *
 * Va en el pie del sidebar, arriba de "Cerrar sesión", que es donde lo pidieron
 * y donde el usuario ya busca lo que tiene que ver con su cuenta.
 *
 * Se esconde con un solo perfil: no hay nada que elegir y sería ruido.
 */
export default function ProfileSwitcher() {
    const { profiles, activeProfile, switchProfile } = useTenant()
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [open])

    if (profiles.length <= 1) return null

    const active = profiles.find((p) => p.id === activeProfile) ?? profiles[0]

    return (
        <div className="relative mb-3" ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-3 h-11 rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 transition-colors text-left"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                {active.kind === 'marca' ? (
                    <Network className="w-4 h-4 text-[#899878] shrink-0" />
                ) : (
                    <Building2 className="w-4 h-4 text-[#899878] shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-[#A7ACA2] leading-none">
                        {active.roleLabel}
                    </span>
                    <span className="block text-xs font-bold text-[#F7F7F2] truncate leading-tight mt-0.5">
                        {active.scopeName}
                    </span>
                </span>
                <ChevronsUpDown className="w-3.5 h-3.5 text-[#A7ACA2] shrink-0" />
            </button>

            {open && (
                <div
                    role="listbox"
                    /* Se abre HACIA ARRIBA: el botón vive al fondo del sidebar y
                       hacia abajo el menú quedaría fuera de la pantalla. */
                    className="absolute bottom-full left-0 mb-2 z-50 w-full max-h-[60vh] overflow-y-auto rounded-2xl border border-white/12 bg-[#1a1a1c] shadow-2xl py-2"
                >
                    <div className="px-3 pb-1.5 text-[9px] font-black uppercase tracking-wider text-[#A7ACA2]">
                        Cambiar de perfil
                    </div>

                    {profiles.map((p) => {
                        const isActive = p.id === active.id
                        return (
                            <button
                                key={p.id}
                                role="option"
                                aria-selected={isActive}
                                onClick={() => {
                                    setOpen(false)
                                    if (!isActive) switchProfile(p.id)
                                }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                                    isActive ? 'bg-white/10' : 'hover:bg-white/5'
                                }`}
                            >
                                {p.kind === 'marca' ? (
                                    <Network className="w-4 h-4 text-[#899878] shrink-0" />
                                ) : (
                                    <Building2 className="w-4 h-4 text-[#A7ACA2] shrink-0" />
                                )}
                                <span className="flex-1 min-w-0">
                                    <span className="block text-[9px] font-black uppercase tracking-wider text-[#A7ACA2] leading-none">
                                        {p.roleLabel}
                                    </span>
                                    <span className="block text-xs font-bold text-[#F7F7F2] truncate leading-tight mt-0.5">
                                        {p.scopeName}
                                    </span>
                                </span>
                                {isActive && <Check className="w-3.5 h-3.5 text-[#899878] shrink-0" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
