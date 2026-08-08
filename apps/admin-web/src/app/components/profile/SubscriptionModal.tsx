'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Shield, Plus, Check, DollarSign, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { evaluateBilling } from '@/lib/billing'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'

type ClassOption = {
    id: number
    name: string
    price_principal: number
    price_additional: number
    color: string
}

export default function SubscriptionModal({
    open,
    onClose,
    initialData // Optional: if we want to pre-fill based on current subscription
}: {
    open: boolean
    onClose: () => void
    initialData?: {
        principal?: number | null
        additional?: number[]
    }
}) {
    // Las clases y la inscripción del alumno son de la sede activa.
    const { mercadoPago, activeDojo } = useTenant()
    const dojoId = activeDojo?.id
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [principalClass, setPrincipalClass] = useState<number | null>(null)
    const [additionalClasses, setAdditionalClasses] = useState<number[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [isNewMember, setIsNewMember] = useState(false)
    const [nextPaymentDue, setNextPaymentDue] = useState<string | null>(null)
    const [memberRole, setMemberRole] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            setLoading(true)
            supabase
                .from('classes')
                .select('*')
                .eq('dojo_id', dojoId ?? NO_DOJO)
                .order('name')
                .then(({ data }) => {
                    if (data) {
                        setClasses(data)
                        // Pre-select based on initialData if available
                        if (initialData) {
                            if (initialData.principal) setPrincipalClass(initialData.principal)
                            if (initialData.additional) setAdditionalClasses(initialData.additional)
                        }
                    }
                })

            // Check if is new member
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    supabase
                        .from('members_with_status')
                        .select('is_new_member, next_payment_due, role')
                        .eq('dojo_id', dojoId ?? NO_DOJO)
                        .eq('user_id', user.id)
                        .maybeSingle()
                        .then(({ data }) => {
                            if (data) {
                                setIsNewMember(!!data.is_new_member)
                                setNextPaymentDue(data.next_payment_due || null)
                                setMemberRole(data.role || null)
                            }
                        })
                }
                setLoading(false)
            })
        }
    }, [open, initialData])

    const handlePrincipalChange = (id: number) => {
        setPrincipalClass(id)
        // Remove from additional if selected there
        setAdditionalClasses(prev => prev.filter(c => c !== id))
    }

    const toggleAdditional = (id: number) => {
        if (id === principalClass) return
        setAdditionalClasses(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        )
    }

    const multiplier = useMemo(() => {
        return evaluateBilling(activeDojo?.billing, {
            endDate: nextPaymentDue,
            isNewMember,
            role: memberRole,
            timezone: activeDojo?.timezone,
        }).multiplier
    }, [nextPaymentDue, isNewMember, memberRole])

    const total = useMemo(() => {
        let sum = 0
        if (principalClass) {
            const p = classes.find(c => c.id === principalClass)
            sum += Number(p?.price_principal || 0)
        }
        additionalClasses.forEach(id => {
            const a = classes.find(c => c.id === id)
            sum += Number(a?.price_additional || a?.price_principal || 0)
        })
        return sum * multiplier
    }, [principalClass, additionalClasses, classes, multiplier])

    const handlePayment = async () => {
        if (!mercadoPago) {
            alert('El pago online con Mercado Pago no está disponible en este momento.')
            return
        }
        try {
            setProcessing(true)

            if (!principalClass) return

            // El precio final lo calcula el servidor (classes + estado de mora).
            // Acá solo mandamos qué clases se eligieron.
            const res = await fetch('/api/payments/mp/preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    principal_id: principalClass,
                    additional_ids: additionalClasses
                })
            })

            if (!res.ok) throw new Error('Error al crear preferencia de pago')

            const data = await res.json()
            // Prioritize production init_point over sandbox
            if (data.init_point) {
                window.location.href = data.init_point
            } else if (data.sandbox_init_point) {
                window.location.href = data.sandbox_init_point
            } else {
                throw new Error('No se recibió link de pago')
            }

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error desconocido'
            console.error(error)
            alert(msg)
            setProcessing(false)
        }
    }

    const fmt = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-carbon-900/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="relative h-24 bg-carbon-900 flex items-center px-8 shrink-0">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-kuro-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-kuro-500/20 flex items-center justify-center text-kuro-400 border border-kuro-500/20">
                                    <DollarSign className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight uppercase">Pagar Suscripción</h2>
                                    <p className="text-carbon-400 text-xs font-bold uppercase tracking-widest">Configura tu plan</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="absolute top-8 right-8 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-carbon-100 rounded-2xl animate-pulse" />)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Principal */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield className="w-4 h-4 text-kuro-500" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-carbon-400">Clase Principal (Obligatoria)</p>
                                        </div>
                                        <div className="space-y-3">
                                            {classes.map(c => (
                                                <label
                                                    key={`p-${c.id}`}
                                                    className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${principalClass === c.id
                                                        ? 'bg-kuro-600 border-kuro-600 shadow-xl shadow-kuro-500/20'
                                                        : 'bg-white border-carbon-100 hover:border-kuro-200'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${principalClass === c.id ? 'bg-white border-white' : 'bg-white border-carbon-300 group-hover:border-kuro-300'
                                                        }`}>
                                                        {principalClass === c.id && <div className="w-2.5 h-2.5 rounded-full bg-kuro-600" />}
                                                    </div>
                                                    <input
                                                        type="radio"
                                                        name="principal"
                                                        className="hidden"
                                                        checked={principalClass === c.id}
                                                        onChange={() => handlePrincipalChange(c.id)}
                                                    />
                                                    <div className="flex-1">
                                                        <p className={`text-sm font-bold leading-none ${principalClass === c.id ? 'text-white' : 'text-carbon-900'}`}>{c.name}</p>
                                                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${principalClass === c.id ? 'text-kuro-100' : 'text-carbon-500'}`}>
                                                            {fmt(c.price_principal)}
                                                        </p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Additional */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Plus className="w-4 h-4 text-kuro-500" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-carbon-400">Clases Adicionales (Opcional)</p>
                                        </div>
                                        <div className="space-y-3">
                                            {classes.map(c => {
                                                const isSelected = additionalClasses.includes(c.id)
                                                const isPrincipal = principalClass === c.id
                                                return (
                                                    <label
                                                        key={`a-${c.id}`}
                                                        className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isSelected
                                                            ? 'bg-kuro-50 border-kuro-500 shadow-lg shadow-kuro-500/10'
                                                            : isPrincipal
                                                                ? 'opacity-40 cursor-not-allowed bg-carbon-50 border-transparent'
                                                                : 'bg-white border-carbon-100 hover:border-kuro-200'
                                                            }`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-kuro-500 border-kuro-500 text-white' : 'bg-white border-carbon-300'
                                                            }`}>
                                                            {isSelected && <Check className="w-3 h-3 stroke-[4]" />}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            disabled={isPrincipal}
                                                            checked={isSelected}
                                                            onChange={() => toggleAdditional(c.id)}
                                                        />
                                                        <div className="flex-1">
                                                            <p className="text-sm font-bold text-carbon-900 leading-none">{c.name}</p>
                                                            <p className="text-[10px] font-black uppercase tracking-widest mt-1 text-kuro-600">
                                                                + {fmt(c.price_additional || c.price_principal)}
                                                            </p>
                                                        </div>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Summary */}
                        <div className="bg-carbon-950 p-6 md:p-8 shrink-0 relative overflow-hidden text-white">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-kuro-600/20 rounded-full blur-[80px] pointer-events-none" />

                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-carbon-400 mb-1">Total Cuota Mensual Estimada</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl md:text-5xl font-black text-white tracking-tight">{fmt(total)}</span>
                                        <span className="text-xs font-bold text-carbon-500 uppercase">ARS / Mes</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className={`w-2 h-2 rounded-full animate-pulse ${isNewMember ? 'bg-kuro-400' : multiplier > 1 ? 'bg-warn-500' : 'bg-kuro-500'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isNewMember ? 'text-kuro-400' : multiplier > 1 ? 'text-warn-500' : 'text-kuro-500'}`}>
                                            {isNewMember ? '✨ Beneficio Alumno Nuevo (Precio Flat)' : multiplier > 1 ? 'Incluye 20% Recargo (Post día 10)' : 'Cálculo Automático'}
                                        </span>
                                    </div>
                                </div>

                                {mercadoPago ? (
                                    <button
                                        onClick={handlePayment}
                                        disabled={processing || !principalClass}
                                        className="w-full md:w-auto px-8 h-16 rounded-2xl bg-[#009EE3] hover:bg-[#0088c7] flex items-center justify-center gap-3 text-white font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-kuro-500/30"
                                    >
                                        {processing ? (
                                            <><Loader2 className="w-5 h-5 animate-spin" /> Redirigiendo…</>
                                        ) : (
                                            'Pagar con Mercado Pago'
                                        )}
                                    </button>
                                ) : (
                                    <div className="w-full md:w-auto px-8 h-16 rounded-2xl bg-carbon-700 flex items-center justify-center text-carbon-400 font-bold text-sm uppercase tracking-widest opacity-50 cursor-not-allowed">
                                        Pago online próximamente
                                    </div>
                                )}
                            </div>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
