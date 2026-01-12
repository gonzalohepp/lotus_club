'use client'

import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { Loader2 } from 'lucide-react'

const PublicMap = dynamic(() => import('./PublicMap'), {
    loading: () => (
        <div className="h-[600px] w-full bg-slate-100 dark:bg-slate-900 rounded-[32px] flex flex-col items-center justify-center text-slate-400 gap-4 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-medium">Cargando mapa de sedes...</p>
        </div>
    ),
    ssr: false
})

export default function AcademiesMapSection({ minimal = false }: { minimal?: boolean }) {
    const { data: academies } = useQuery({
        queryKey: ['public-academies'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('academies')
                .select('*')
                .eq('is_active', true)
            if (error) {
                console.error('Error fetching academies:', error)
                return []
            }
            return data || []
        }
    })

    // Dummy data fallback for preview if DB is empty
    const displayAcademies = academies && academies.length > 0 ? academies : []

    if (minimal) {
        return <PublicMap academies={displayAcademies} />
    }

    return (
        <section id="academias" className="py-24 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <span className="text-blue-500 font-bold tracking-widest text-xs uppercase mb-2 block">
                        Nuestra Red
                    </span>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
                        Encontrá tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Dojo</span> más cercano
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Contamos con múltiples sedes equipadas con la mejor infraestructura para tu entrenamiento.
                        Busca en el mapa y vení a conocer tu próxima academia.
                    </p>
                </div>

                <PublicMap academies={displayAcademies} />
            </div>
        </section>
    )
}
