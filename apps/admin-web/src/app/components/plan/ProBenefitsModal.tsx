'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Crown, Check } from 'lucide-react'
import { type FeatureKey } from '@/lib/features'
import { useTenant } from '@/lib/tenant/context'

const FEATURE_LABELS: Record<FeatureKey, string> = {
    qr: 'QR de acceso',
    members: 'Gestión de alumnos',
    classes: 'Gestión de clases',
    accessLog: 'Historial de accesos',
    dojos: 'Sedes',
    graduations: 'Graduaciones y cinturones',
    payments: 'Cobros y pagos',
    mercadopago: 'Cobros con Mercado Pago',
    metrics: 'Métricas',
    reports: 'Reportes',
    asistenciaVivo: 'Asistencia en vivo',
    notifications: 'Notificaciones push',
}

const FEATURE_ORDER: FeatureKey[] = [
    'qr', 'members', 'classes', 'accessLog', 'dojos', 'graduations',
    'payments', 'mercadopago', 'metrics', 'reports', 'asistenciaVivo', 'notifications',
]

export default function ProBenefitsModal({ open, onClose }: { open: boolean, onClose: () => void }) {
    const { mercadoPago } = useTenant()

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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg overflow-hidden rounded-[32px] bg-white dark:bg-carbon-900 shadow-2xl max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="relative shrink-0 px-8 pt-8 pb-6 border-b border-carbon-100 dark:border-carbon-800">
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-carbon-100 dark:bg-white/10 flex items-center justify-center text-carbon-500 dark:text-carbon-300 hover:bg-carbon-200 dark:hover:bg-white/20 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warn-100 dark:bg-warn-500/10 text-warn-600 dark:text-warn-400 text-[10px] font-black tracking-widest uppercase mb-4">
                                <Crown className="w-3 h-3" />
                                Plan Pro
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-carbon-900 dark:text-white tracking-tight">
                                Ya tenés todo desbloqueado
                            </h2>
                            <p className="text-sm text-carbon-500 dark:text-carbon-400 font-medium mt-2">
                                Tu instancia corre con el plan Pro completo — estos son todos los beneficios activos.
                            </p>
                        </div>

                        {/* Body: benefits list */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                            <ul className="space-y-3">
                                {FEATURE_ORDER.filter(key => key !== 'mercadopago' || mercadoPago).map(key => (
                                    <li key={key} className="flex items-center gap-3 p-3 rounded-2xl bg-warn-50/50 dark:bg-warn-500/5">
                                        <div className="w-7 h-7 rounded-full bg-warn-500 flex items-center justify-center shrink-0">
                                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                        </div>
                                        <span className="text-sm font-semibold text-carbon-700 dark:text-carbon-200">
                                            {FEATURE_LABELS[key]}
                                        </span>
                                        {key === 'dojos' && (
                                            <span className="ml-auto text-xs font-bold text-warn-600 dark:text-warn-400 whitespace-nowrap">
                                                Sedes ilimitadas
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-8 py-6 border-t border-carbon-100 dark:border-carbon-800 bg-carbon-50/50 dark:bg-white/[0.02] text-center">
                            <p className="text-xs font-bold text-carbon-400 uppercase tracking-widest">
                                Gracias por confiar en nosotros para tu dojo.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
