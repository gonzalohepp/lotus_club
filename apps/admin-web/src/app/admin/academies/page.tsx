'use client'

import { useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Plus, Search, MapPin, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import AcademyList from '@/components/academies/AcademyList'
import AcademyModal from '@/components/academies/AcademyModal'

export default function AcademiesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedAcademy, setSelectedAcademy] = useState(null)

    return (
        <AdminLayout active="/admin/academies">
            <div className="relative min-h-screen">
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10 p-6 md:p-8">
                    {/* Header */}
                    <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                        <div className="flex-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-widest uppercase mb-4">
                                <MapPin className="w-3 h-3" />
                                GESTIÓN DE SEDES
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-3">
                                Administrar <span className="text-blue-600 dark:text-blue-400">Academias</span>
                            </h1>
                            <p className="text-slate-500 text-lg font-medium flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500 fill-current" />
                                Configurá las ubicaciones oficiales del dojo
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o ciudad..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium focus:ring-2 ring-blue-500/20 outline-none transition-all dark:text-white shadow-sm"
                                />
                            </div>

                            <button
                                onClick={() => { setSelectedAcademy(null); setIsModalOpen(true) }}
                                className="w-full sm:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4" strokeWidth={3} />
                                Nueva Academia
                            </button>
                        </div>
                    </header>

                    {/* Content Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <AcademyList
                            search={search}
                            onEdit={(academy) => { setSelectedAcademy(academy); setIsModalOpen(true) }}
                        />
                    </motion.div>

                    {/* Modal */}
                    <AnimatePresence>
                        {isModalOpen && (
                            <AcademyModal
                                isOpen={isModalOpen}
                                onClose={() => setIsModalOpen(false)}
                                academy={selectedAcademy}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </AdminLayout>
    )
}
