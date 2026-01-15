'use client'

import dynamic from 'next/dynamic'
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

const STATIC_ACADEMIES = [
    {
        id: 1,
        name: "Lotus Club",
        city: "Quilmes",
        address: "Av. Calchaquí 4335",
        lat: -34.763093,
        lng: -58.279298,
        description: "Sede central de Lotus Club. Especialistas en BJJ y Grappling.",
        classes: "Jiu-Jitsu, Grappling, MMA, Judo",
        professors: "Instructor Principal",
        schedules: "Lunes a Viernes 08:00 - 22:00"
    }
]

export default function AcademiesMapSection({ minimal = false }: { minimal?: boolean }) {
    if (minimal) {
        return <PublicMap academies={STATIC_ACADEMIES} />
    }

    return (
        <section id="academias" className="py-24 relative overflow-hidden">
            <div className="absolute inset-0 bg-black pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <span className="text-red-500 font-bold tracking-widest text-xs uppercase mb-2 block">
                        Nuestra Red
                    </span>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
                        Encontrá tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-600">Dojo</span> más cercano
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Contamos con múltiples sedes equipadas con la mejor infraestructura para tu entrenamiento.
                        Busca en el mapa y vení a conocer tu próxima academia.
                    </p>
                </div>

                <PublicMap academies={STATIC_ACADEMIES} />
            </div>
        </section>
    )
}
