'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, Check, Info, Loader2, MapPin, Phone, Search, Settings2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

import AdminLayout from '../../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context'

/**
 * /admin/academies — Sedes de la marca.
 *
 * Dos correcciones respecto de la versión anterior:
 *
 *  1. Lee de `dojos`, no de la tabla `academies`. Esta pantalla mostraba una
 *     tabla heredada que existía sólo para el mapa de la landing, así que
 *     después del multi-tenant quedó desincronizada de las sedes reales — por
 *     eso aparecía vacía aunque hubiera sucursales cargadas.
 *
 *  2. Es de SÓLO LECTURA salvo para el desarrollador. El superadmin de la marca
 *     ve sus sedes, pero el alta y la edición pasan por el dev: el límite de
 *     sedes por plan (Basic = 1, Pro = ilimitadas) es una condición comercial,
 *     y si la marca pudiera crearlas sola sería apenas una sugerencia.
 */

type DojoRow = {
    id: string
    name: string
    slug: string
    city: string | null
    address: string | null
    phone: string | null
    timezone: string
    is_active: boolean
}

export default function AcademiesPage() {
    const { allows, org, activeDojo } = useTenant()
    const canManage = allows('manageDojos')

    const [dojos, setDojos] = useState<DojoRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        const load = async () => {
            if (!org) {
                setLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('dojos')
                .select('id, name, slug, city, address, phone, timezone, is_active')
                .eq('org_id', org.id)
                .order('name')

            if (error) console.error('[academies] load error:', error)

            setDojos((data ?? []) as DojoRow[])
            setLoading(false)
        }
        load()
    }, [org])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return dojos
        return dojos.filter(
            (d) =>
                d.name.toLowerCase().includes(q) ||
                (d.city ?? '').toLowerCase().includes(q) ||
                (d.address ?? '').toLowerCase().includes(q)
        )
    }, [dojos, search])

    return (
        <AdminLayout active="/admin/academies">
            <div className="relative min-h-screen">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10">
                    <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                        <div>
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">
                                <MapPin className="w-3 h-3" />
                                Gestión de sedes
                            </span>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                                Administrar <span className="text-blue-600 dark:text-blue-400">Academias</span>
                            </h1>
                            <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">
                                Sedes de{' '}
                                <span className="font-black text-slate-700 dark:text-slate-200">{org?.name}</span>
                                {dojos.length > 0 && ` — ${dojos.length} en total`}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar por nombre o ciudad…"
                                    className="h-11 w-full md:w-64 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 ring-blue-500/20"
                                />
                            </div>

                            {canManage && (
                                <Link
                                    href="/superadmin"
                                    className="h-11 px-5 flex items-center gap-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                                >
                                    <Settings2 className="w-4 h-4" />
                                    Administrar
                                </Link>
                            )}
                        </div>
                    </header>

                    {!canManage && (
                        <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-800/40">
                            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-900 dark:text-blue-200">
                                Estás viendo las sedes de tu red. Para dar de alta una nueva o modificar los datos de
                                una existente, contactá al desarrollador de la plataforma.
                            </p>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-20">
                            <Loader2 className="w-4 h-4 animate-spin" /> Cargando sedes…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 rounded-3xl border border-slate-200 dark:border-slate-800">
                            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
                            <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                                {search ? 'Sin resultados' : 'No hay sedes registradas'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filtered.map((dojo, i) => (
                                <motion.div
                                    key={dojo.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className={`p-5 rounded-2xl border transition-colors ${
                                        dojo.id === activeDojo?.id
                                            ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                                            : 'border-slate-200 dark:border-slate-800'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="min-w-0">
                                            <h3 className="font-black truncate">{dojo.name}</h3>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                {dojo.slug}
                                            </p>
                                        </div>

                                        <span
                                            className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                dojo.is_active
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                            }`}
                                        >
                                            {dojo.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                            {dojo.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </div>

                                    <dl className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                                        <div className="flex items-start gap-2">
                                            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <dd className="min-w-0">
                                                {[dojo.address, dojo.city].filter(Boolean).join(', ') || '—'}
                                            </dd>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3.5 h-3.5 shrink-0" />
                                            <dd>{dojo.phone || '—'}</dd>
                                        </div>
                                    </dl>

                                    {dojo.id === activeDojo?.id && (
                                        <p className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-blue-500">
                                            Sede activa
                                        </p>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
