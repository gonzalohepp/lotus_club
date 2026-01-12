'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

export default function MapSelector({
    lat,
    lng,
    onLocationSelect,
}: {
    lat?: number
    lng?: number
    onLocationSelect: (lat: number, lng: number) => void
}) {
    const Map = useMemo(() => dynamic(
        () => import('./LeafletMap'),
        {
            loading: () => <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 font-medium">Cargando mapa...</div>,
            ssr: false
        }
    ), [])

    return (
        <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
            <Map
                lat={lat}
                lng={lng}
                onLocationSelect={onLocationSelect}
            />
        </div>
    )
}
