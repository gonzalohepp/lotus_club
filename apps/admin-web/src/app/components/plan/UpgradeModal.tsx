'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Check, Minus, Mail } from 'lucide-react'
import { FEATURES_BY_PLAN, type FeatureKey } from '@/lib/features'

// TODO: reemplazar por el canal de contacto real (mailto, WhatsApp, formulario, etc.)
const UPGRADE_CONTACT_URL = 'mailto:contacto@tu-dominio.com?subject=Quiero%20actualizar%20a%20Pro'

const FEATURE_LABELS: Record<FeatureKey, string> = {
    qr: 'QR de acceso',
    members: 'Gestión de miembros',
    classes: 'Gestión de clases',
    accessLog: 'Historial de accesos',
    academies: 'Sedes (academias)',
    graduations: 'Graduaciones y cinturones',
    payments: 'Cobros con Mercado Pago',
    metrics: 'Métricas',
    reports: 'Reportes',
    asistenciaVivo: 'Asistencia en vivo',
    notifications: 'Notificaciones push',
}

const FEATURE_ORDER: FeatureKey[] = [
    'qr', 'members', 'classes', 'accessLog', 'academies', 'graduations',
    'payments', 'metrics', 'reports', 'asistenciaVivo', 'notifications',
]

// Academias es `true` en ambos planes (el límite real es numérico, ver
// getAcademyLimit() en lib/features.ts) — acá mostramos ese matiz en vez del
// check genérico, que sería engañoso.
const ACADEMY_OVERRIDE = { basic: '1 sede', pro: 'Sedes ilimitadas' }

function FeatureCell({ included = false, override }: { included?: boolean, override?: string }) {
    if (override) {
        return <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{override}</span>
    }
    return included
        ? <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={3} />
        : <Minus className="w-4 h-4 text-slate-300 dark:text-slate-700 shrink-0" strokeWidth={3} />
}

export default function UpgradeModal({ open, onClose }: { open: boolean, onClose: () => void }) {
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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-3xl overflow-hidden rounded-[32px] bg-white dark:bg-slate-900 shadow-2xl max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="relative shrink-0 px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black tracking-widest uppercase mb-4">
                                <Sparkles className="w-3 h-3" />
                                Actualizá tu plan
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                Desbloqueá todo el potencial de tu dojo
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
                                Misma cuenta, mismos datos — al pasar a Pro solo activamos las funciones bloqueadas, sin migrar nada.
                            </p>
                        </div>

                        {/* Body: comparison */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Basic column */}
                                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                                    <div className="flex items-center justify-between mb-1 gap-2">
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Basic</h3>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full whitespace-nowrap">
                                            Tu plan actual
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Lo esencial para arrancar</p>
                                    <ul className="space-y-3">
                                        {FEATURE_ORDER.map(key => (
                                            <li key={key} className="flex items-center justify-between gap-3 text-sm">
                                                <span className="text-slate-600 dark:text-slate-300 font-medium">{FEATURE_LABELS[key]}</span>
                                                {key === 'academies'
                                                    ? <FeatureCell override={ACADEMY_OVERRIDE.basic} />
                                                    : <FeatureCell included={FEATURES_BY_PLAN.basic[key]} />}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Pro column */}
                                <div className="relative rounded-3xl border-2 border-blue-500/40 p-6 bg-gradient-to-b from-blue-50/60 to-transparent dark:from-blue-500/10 dark:to-transparent shadow-lg shadow-blue-500/10">
                                    <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-md">
                                        Recomendado
                                    </div>
                                    <div className="flex items-center justify-between mb-1 pt-1">
                                        <h3 className="text-lg font-black text-blue-700 dark:text-blue-400 uppercase tracking-tight">Pro</h3>
                                    </div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Todo el poder del panel</p>
                                    <ul className="space-y-3">
                                        {FEATURE_ORDER.map(key => (
                                            <li key={key} className="flex items-center justify-between gap-3 text-sm">
                                                <span className="text-slate-700 dark:text-slate-200 font-semibold">{FEATURE_LABELS[key]}</span>
                                                {key === 'academies'
                                                    ? <FeatureCell override={ACADEMY_OVERRIDE.pro} />
                                                    : <FeatureCell included={FEATURES_BY_PLAN.pro[key]} />}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Footer CTA */}
                        <div className="shrink-0 px-8 py-6 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.02]">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center md:text-left">
                                Te contamos precio y tiempos de activación a medida.
                            </p>
                            <a
                                href={UPGRADE_CONTACT_URL}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
                            >
                                <Mail className="w-4 h-4" />
                                Contactanos
                            </a>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
