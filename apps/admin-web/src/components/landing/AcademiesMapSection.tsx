'use client'

import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { Loader2 } from 'lucide-react'

const PublicMap = dynamic(() => import('./PublicMap'), {
    loading: () => (
        <div className="h-[600px] w-full bg-carbon-100 dark:bg-carbon-900 rounded-[32px] flex flex-col items-center justify-center text-carbon-400 gap-4 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-medium">Cargando mapa de sedes...</p>
        </div>
    ),
    ssr: false
})

/**
 * Organización cuyas sedes se muestran en esta landing.
 *
 * La plataforma es multi-marca pero la landing es una sola, así que sin filtro
 * el mapa mezclaría las sucursales de todos los clientes. Vacío = muestra
 * todas, que es lo correcto mientras haya una sola organización.
 */
const LANDING_ORG = process.env.NEXT_PUBLIC_LANDING_ORG

export default function AcademiesMapSection({ minimal = false }: { minimal?: boolean }) {
    const { data: academies } = useQuery({
        queryKey: ['public-dojos', LANDING_ORG],
        queryFn: async () => {
            // Lee `dojos`, no la tabla `academies` heredada: esa quedó
            // desincronizada de las sedes reales al pasar a multi-tenant y por
            // eso el mapa aparecía vacío.
            let query = supabase
                .from('dojos')
                .select('id, name, city, address, lat, lng, phone, team, instructor, instructor_rank, schedules_text, maps_url, organizations!inner(slug)')
                .eq('is_active', true)

            if (LANDING_ORG) query = query.eq('organizations.slug', LANDING_ORG)

            const { data, error } = await query

            if (error) {
                console.error('Error fetching dojos:', error)
                return []
            }

            // El mapa necesita coordenadas; una sede sin lat/lng no se puede pinchar.
            return (data || []).filter((d) => d.lat != null && d.lng != null)
        }
    })

    // Dummy data fallback for preview if DB is empty
    const displayAcademies = academies && academies.length > 0 ? academies : []

    if (minimal) {
        return <PublicMap
            academies={displayAcademies}
            initialCenter={[-34.775826, -58.252102]}
            initialZoom={12}
            hideSidebar={true}
        />
    }

    return (
        <section id="academias" className="py-24 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-kuro-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <span className="text-kuro-500 font-bold tracking-widest text-xs uppercase mb-2 block">
                        Nuestra Red
                    </span>
                    <h2 className="text-4xl md:text-5xl font-black text-carbon-900 dark:text-white tracking-tight mb-6">
                        Encontrá tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-kuro-600 to-kuro-600">Dojo</span> más cercano
                    </h2>
                    <p className="text-lg text-carbon-600 dark:text-carbon-400 leading-relaxed">
                        Contamos con múltiples sedes equipadas con la mejor infraestructura para tu entrenamiento.
                        Busca en el mapa y vení a conocer tu próxima academia.
                    </p>
                </div>

                <PublicMap academies={displayAcademies} />
            </div>
        </section>
    )
}
