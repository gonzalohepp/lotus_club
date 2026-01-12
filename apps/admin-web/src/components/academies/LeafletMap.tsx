'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom DIV ICON for Marker Selection (Premium CSS-based)
const selectionIcon = L.divIcon({
    className: 'custom-marker-selection',
    html: `
        <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-pulse"></div>
            <div class="relative w-8 h-8 bg-blue-600 rounded-xl rotate-45 border-2 border-white shadow-xl flex items-center justify-center">
                <div class="-rotate-45">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                </div>
            </div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
})

function LocationMarker({ position, setPosition }: { position: { lat: number, lng: number } | null, setPosition: (pos: { lat: number, lng: number }) => void }) {
    const map = useMap()

    useEffect(() => {
        if (position) {
            map.flyTo(position, map.getZoom())
        }
    }, [position, map])

    useMapEvents({
        click(e) {
            setPosition(e.latlng)
        },
    })

    return position === null ? null : (
        <Marker position={position} icon={selectionIcon} />
    )
}

export default function LeafletMap({
    lat,
    lng,
    onLocationSelect,
}: {
    lat?: number
    lng?: number
    onLocationSelect: (lat: number, lng: number) => void
}) {
    // Default to Buenos Aires if no location
    const center = lat && lng ? [lat, lng] as [number, number] : [-34.6037, -58.3816] as [number, number]
    const position = lat && lng ? { lat, lng } : null

    return (
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker
                position={position}
                setPosition={(pos) => onLocationSelect(pos.lat, pos.lng)}
            />
        </MapContainer>
    )
}
