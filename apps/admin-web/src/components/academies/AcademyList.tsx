import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { MapPin, Edit2, Trash2, Globe, Clock, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

const ITEMS_PER_PAGE = 6

export default function AcademyList({ search, onEdit }: { search: string, onEdit: (academy: any) => void }) {
    const queryClient = useQueryClient()
    const [currentPage, setCurrentPage] = useState(1)

    const { data: academies, isLoading } = useQuery({
        queryKey: ['academies'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('academies')
                .select('*')
                .order('id', { ascending: false })
            if (error) throw error
            return data
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await supabase.from('academies').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['academies'] })
        }
    })

    // Filtered academies
    const filteredAcademies = useMemo(() => {
        if (!academies) return []
        const s = search.toLowerCase()
        return academies.filter(a =>
            a.name.toLowerCase().includes(s) ||
            a.city.toLowerCase().includes(s)
        )
    }, [academies, search])

    // Pagination
    const totalPages = Math.ceil(filteredAcademies.length / ITEMS_PER_PAGE)
    const paginatedAcademies = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return filteredAcademies.slice(start, start + ITEMS_PER_PAGE)
    }, [filteredAcademies, currentPage])

    // Reset to first page when search changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentPage(1)
    }, [search])

    if (isLoading) return <div className="text-center py-20 text-slate-500 font-medium">Cargando academias...</div>

    if (!academies || academies.length === 0) {
        return (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-[32px] border border-dashed border-slate-200 dark:border-slate-700">
                <Info className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay academias registradas</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {paginatedAcademies.map((academy) => (
                        <motion.div
                            key={academy.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="group relative bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:border-blue-500/30"
                        >
                            {/* Image/Map Placeholder */}
                            <div className="h-40 bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                                {academy.image_url ? (
                                    <Image
                                        src={academy.image_url}
                                        alt={academy.name}
                                        fill
                                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                        <MapPin className="w-10 h-10 opacity-10" />
                                    </div>
                                )}
                                <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 shadow-2xl">
                                    <p className="text-[10px] text-white font-black uppercase tracking-[0.2em]">{academy.city}</p>
                                </div>
                            </div>

                            <div className="p-6">
                                <h3 className="font-black text-slate-900 dark:text-white mb-1 group-hover:text-blue-500 transition-colors uppercase tracking-tight">
                                    {academy.name}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
                                    {academy.address}
                                </p>

                                <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                        {academy.lat?.toFixed(3)}, {academy.lng?.toFixed(3)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                    <button
                                        onClick={() => onEdit(academy)}
                                        className="flex-1 h-10 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm('¿Estás seguro de eliminar esta academia?')) {
                                                deleteMutation.mutate(academy.id)
                                            }
                                        }}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-8 pb-4">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2">
                        {(() => {
                            const pages = []
                            const maxVisible = 5

                            if (totalPages <= maxVisible + 2) {
                                for (let i = 1; i <= totalPages; i++) pages.push(i)
                            } else {
                                pages.push(1)
                                let start = Math.max(2, currentPage - 1)
                                let end = Math.min(totalPages - 1, currentPage + 1)
                                if (currentPage <= 3) end = 4
                                if (currentPage >= totalPages - 2) start = totalPages - 3
                                if (start > 2) pages.push('...')
                                for (let i = start; i <= end; i++) pages.push(i)
                                if (end < totalPages - 1) pages.push('...')
                                pages.push(totalPages)
                            }

                            return pages.map((pageNum, idx) => {
                                if (pageNum === '...') {
                                    return <span key={`dots-${idx}`} className="w-10 h-10 flex items-center justify-center text-slate-400 font-bold">...</span>
                                }

                                const isActive = currentPage === pageNum
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum as number)}
                                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${isActive
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-500/50'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })
                        })()}
                    </div>

                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            {filteredAcademies.length === 0 && (
                <div className="text-center py-20">
                    <p className="text-slate-400 font-medium">No se encontraron academias para tu búsqueda</p>
                </div>
            )}
        </div>
    )
}
