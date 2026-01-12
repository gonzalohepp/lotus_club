'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Shield, Plus, Check, DollarSign, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

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
    initialData?: any
}) {
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [principalClass, setPrincipalClass] = useState<number | null>(null)
    const [additionalClasses, setAdditionalClasses] = useState<number[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        if (open) {
            setLoading(true)
            supabase
                .from('classes')
                .select('*')
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

    const total = useMemo(() => {
        let sum = 0
        if (principalClass) {
            const p = classes.find(c => c.id === principalClass)
            sum += Number(p?.price_principal || 0)
        }
        additionalClasses.forEach(id => {
            const a = classes.find(c => c.id === id)
            // If it's additional, use price_additional if exists, else price_principal (or logic as per MemberForm)
            // Actually MemberForm logic: total += Number(a?.price_additional || a?.price_principal || 0)
            sum += Number(a?.price_additional || a?.price_principal || 0)
        })
        return sum
    }, [principalClass, additionalClasses, classes])

    const handlePayment = async () => {
        try {
            setProcessing(true)

            // Prepare items
            const items = []

            // Principal
            const p = classes.find(c => c.id === principalClass)
            if (p) {
                items.push({
                    id: p.id,
                    title: `Clase Principal: ${p.name}`,
                    price: Number(p.price_principal || 0)
                })
            }

            // Additional
            additionalClasses.forEach(id => {
                const a = classes.find(c => c.id === id)
                if (a) {
                    items.push({
                        id: a.id,
                        title: `Adicional: ${a.name}`,
                        price: Number(a.price_additional || a.price_principal || 0)
                    })
                }
            })

            if (items.length === 0) return

            // Get user info for payer email (best effort, or auth user)
            const { data: { user } } = await supabase.auth.getUser()

            const res = await fetch('/api/payments/mp/preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    payer_email: user?.email
                })
            })

            if (!res.ok) throw new Error('Error al crear preferencia de pago')

            const data = await res.json()
            // Prefer sandbox_init_point if available (especially for test credentials)
            if (data.sandbox_init_point) {
                window.location.href = data.sandbox_init_point
            } else if (data.init_point) {
                window.location.href = data.init_point
            } else {
                throw new Error('No se recibió link de pago')
            }

        } catch (error: any) {
            console.error(error)
            alert(error.message || 'Error desconocido')
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
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="relative h-24 bg-slate-900 flex items-center px-8 shrink-0">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                    <DollarSign className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight uppercase">Pagar Suscripción</h2>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Configura tu plan</p>
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
                                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Principal */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield className="w-4 h-4 text-blue-500" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clase Principal (Obligatoria)</p>
                                        </div>
                                        <div className="space-y-3">
                                            {classes.map(c => (
                                                <label
                                                    key={`p-${c.id}`}
                                                    className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${principalClass === c.id
                                                        ? 'bg-blue-600 border-blue-600 shadow-xl shadow-blue-500/20'
                                                        : 'bg-white border-slate-100 hover:border-blue-200'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${principalClass === c.id ? 'bg-white border-white' : 'bg-white border-slate-300 group-hover:border-blue-300'
                                                        }`}>
                                                        {principalClass === c.id && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                                    </div>
                                                    <input
                                                        type="radio"
                                                        name="principal"
                                                        className="hidden"
                                                        checked={principalClass === c.id}
                                                        onChange={() => handlePrincipalChange(c.id)}
                                                    />
                                                    <div className="flex-1">
                                                        <p className={`text-sm font-bold leading-none ${principalClass === c.id ? 'text-white' : 'text-slate-900'}`}>{c.name}</p>
                                                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${principalClass === c.id ? 'text-blue-100' : 'text-slate-500'}`}>
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
                                            <Plus className="w-4 h-4 text-emerald-500" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clases Adicionales (Opcional)</p>
                                        </div>
                                        <div className="space-y-3">
                                            {classes.map(c => {
                                                const isSelected = additionalClasses.includes(c.id)
                                                const isPrincipal = principalClass === c.id
                                                return (
                                                    <label
                                                        key={`a-${c.id}`}
                                                        className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isSelected
                                                            ? 'bg-emerald-50 border-emerald-500 shadow-lg shadow-emerald-500/10'
                                                            : isPrincipal
                                                                ? 'opacity-40 cursor-not-allowed bg-slate-50 border-transparent'
                                                                : 'bg-white border-slate-100 hover:border-emerald-200'
                                                            }`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'
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
                                                            <p className="text-sm font-bold text-slate-900 leading-none">{c.name}</p>
                                                            <p className="text-[10px] font-black uppercase tracking-widest mt-1 text-emerald-600">
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
                        <div className="bg-slate-950 p-6 md:p-8 shrink-0 relative overflow-hidden text-white">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none" />

                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Cuota Mensual Estimada</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl md:text-5xl font-black text-white tracking-tight">{fmt(total)}</span>
                                        <span className="text-xs font-bold text-slate-500 uppercase">ARS / Mes</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Cálculo Automático</span>
                                    </div>
                                </div>

                                <button
                                    disabled={!principalClass || total === 0 || processing}
                                    onClick={handlePayment}
                                    className="w-full md:w-auto h-16 px-8 rounded-2xl bg-[#009EE3] hover:bg-[#008ED0] text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-[#009EE3]/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3"
                                >
                                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Pagar con Mercado Pago</span>}
                                </button>
                            </div>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
