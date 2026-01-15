'use client'

import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Search, MapPin, ExternalLink, Clock, Navigation, GraduationCap, Info, X, Dumbbell, LocateFixed } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface Academy {
    id: number
    name: string
    city: string
    address: string
    lat: number
    lng: number
    image_url?: string
    website_url?: string
    description?: string
    schedules?: string
    professors?: string
    classes?: string
}

// ARGENTINA DEFAULT VIEW
const ARG_CENTER: [number, number] = [-38.4161, -63.6167]
const ARG_ZOOM = 4
const ARG_BOUNDS: [[number, number], [number, number]] = [
    [-20.0, -78.0], // Limit Northwest (Bolivia/Chile border)
    [-56.0, -52.0]  // Limit Southeast (Tierra del Fuego/Atlantic)
]

// Shared Leaflet Fix
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom DIV ICON for Academies (Premium CSS-based)
// Custom DIV ICON for Academies (Premium CSS-based)
const createCustomIcon = (isSelected: boolean) => {
    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div class="relative flex items-center justify-center">
                ${isSelected ? '<div class="absolute w-14 h-14 bg-red-500/40 rounded-full animate-ping"></div>' : ''}
                <div class="relative w-12 h-12 ${isSelected ? 'scale-110 z-10' : ''} bg-red-600 rounded-full border-[3px] border-white shadow-xl flex items-center justify-center transition-all duration-300 overflow-hidden">
                    <span class="text-2xl leading-none pt-1">🥋</span>
                </div>
                ${isSelected ? '<div class="absolute -bottom-2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-red-600"></div>' : ''}
            </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 52], // Tip of the pointer
    })
}

// Custom User Location Icon
const createUserIcon = () => {
    return L.divIcon({
        className: 'user-marker',
        html: `
            <div class="relative flex items-center justify-center w-6 h-6">
                <div class="absolute w-full h-full bg-red-500/50 rounded-full animate-ping"></div>
                <div class="relative w-4 h-4 bg-red-600 border-2 border-white rounded-full shadow-lg"></div>
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    })
}


// Custom Cluster Icon
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createClusterIcon = (cluster: any) => {
    const count = cluster.getChildCount()
    return L.divIcon({
        className: 'custom-cluster-marker',
        html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;">
                <div style="position: absolute; width: 40px; height: 40px; background: rgba(239, 68, 68, 0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
                <div style="position: relative; width: 36px; height: 36px; background: #dc2626; border: 3px solid white; border-radius: 50%; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px; letter-spacing: -0.5px;">
                   +${count}
                </div>
            </div>
            <style>
                @keyframes pulse {
                    0% { transform: scale(0.8); opacity: 0.8; }
                    50% { transform: scale(1.3); opacity: 0.3; }
                    100% { transform: scale(0.8); opacity: 0.8; }
                }
            </style>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    })
}

function SafeMapController({ center, zoom, viewMode }: { center: [number, number], zoom?: number, viewMode?: 'map' | 'list' }) {
    const map = useMap()

    // Fix for map rendering when switching from hidden to visible (Mobile Toggle)
    useEffect(() => {
        if (viewMode === 'map') {
            // Small delay to ensure container transition is done
            setTimeout(() => {
                map.invalidateSize()
            }, 300)
        }
    }, [viewMode, map])

    useEffect(() => {
        if (!center || !Array.isArray(center) || center.length !== 2) return

        const lat = Number(center[0])
        const lng = Number(center[1])

        // Aggressive safety check to prevent NaN/Infinity crashes
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.error('SafeMapController: BLOCKED invalid coordinates', { lat, lng, original: center })
            return
        }

        // Value comparison to avoid unnecessary flying
        const isDefault = Math.abs(lat - ARG_CENTER[0]) < 0.0001 && Math.abs(lng - ARG_CENTER[1]) < 0.0001

        if (!isDefault) {
            const fly = () => {
                try {
                    // Critical: Check if map has size before flying
                    const size = map.getSize()
                    if (size.x === 0 || size.y === 0) {
                        console.log('SafeMapController: Map size is 0, invalidating and retrying...')
                        map.invalidateSize()
                        setTimeout(fly, 50) // Retry after small delay
                        return
                    }

                    // Final check before calling Leaflet
                    const target = L.latLng(lat, lng)
                    if (Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
                        map.flyTo(target, zoom || 15, { duration: 1.5 })
                    }
                } catch (err) {
                    console.error('SafeMapController: flyTo failed', err)
                }
            }

            fly()
        }
    }, [center, zoom, map])
    return null
}

export default function PublicMap({ academies }: { academies: Academy[] }) {
    const [selected, setSelected] = useState<Academy | null>(null)
    const [search, setSearch] = useState('')
    const [mapCenter, setMapCenter] = useState<[number, number]>(ARG_CENTER)
    const [mapZoom, setMapZoom] = useState<number>(ARG_ZOOM)
    const [isLocating, setIsLocating] = useState(false)
    const [viewMode, setViewMode] = useState<'map' | 'list'>('list')
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null)

    // Filter academies
    const filtered = useMemo(() => {
        if (!search) return academies
        const s = search.toLowerCase()
        return academies.filter(a =>
            a.name.toLowerCase().includes(s) ||
            a.city.toLowerCase().includes(s) ||
            a.address.toLowerCase().includes(s)
        )
    }, [academies, search])

    const handleSelect = (academy: Academy) => {
        setSelected(academy)
        const lat = Number(academy.lat)
        const lng = Number(academy.lng)

        if (!isNaN(lat) && !isNaN(lng)) {
            setMapCenter([lat, lng])
            setMapZoom(16)
            // On mobile, switch to map view when an academy is selected from the list
            if (window.innerWidth < 1024) {
                setViewMode('map')
            }
        }
    }

    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            alert("Tu navegador no soporta geolocalización")
            return
        }

        setIsLocating(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude
                const lng = pos.coords.longitude

                if (!isNaN(lat) && !isNaN(lng)) {
                    const loc: [number, number] = [lat, lng]
                    setMapCenter(loc)
                    setMapZoom(14)
                    setUserLocation(loc)

                    // Switch to map view on mobile
                    if (window.innerWidth < 1024) {
                        setViewMode('map')
                    }
                }
                setIsLocating(false)
            },
            () => {
                alert("No se pudo obtener tu ubicación")
                setIsLocating(false)
            },
            { enableHighAccuracy: true }
        )
    }

    return (
        <div className="flex flex-col lg:flex-row h-[600px] md:h-[700px] w-full rounded-[2rem] md:rounded-[32px] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl relative bg-white dark:bg-slate-950">
            {/* Mobile View Toggle */}
            <div className="lg:hidden flex p-2 gap-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setViewMode('list')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}
                >
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4" /> Lista
                    </div>
                </button>
                <button
                    onClick={() => setViewMode('map')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}
                >
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Mapa
                    </div>
                </button>
            </div>

            {/* Left Sidebar: Search & List */}
            <div className={`w-full lg:w-80 bg-white dark:bg-slate-900 flex flex-col border-r border-slate-200 dark:border-slate-800 z-20 ${viewMode === 'map' ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-lg text-slate-800 dark:text-white tracking-tight">Academias</h3>
                        <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">
                            Argentina
                        </span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            placeholder="Buscar por ciudad..."
                            className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-2 ring-red-500/20 outline-none transition-all"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Geolocation Button */}
                    <button
                        onClick={handleLocateMe}
                        disabled={isLocating}
                        className="w-full h-10 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border border-red-100 dark:border-red-800/30 transition-all active:scale-95"
                    >
                        {isLocating ? (
                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <LocateFixed className="w-4 h-4" />
                        )}
                        {isLocating ? "Obteniendo ubicación..." : "Buscar cerca mío"}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                    {filtered.map(academy => (
                        <motion.div
                            layoutId={String(academy.id)}
                            key={academy.id}
                            onClick={() => handleSelect(academy)}
                            className={`
                                p-4 rounded-xl cursor-pointer border transition-all duration-300 group
                                ${selected?.id === academy.id
                                    ? 'bg-red-600 border-red-500 shadow-lg shadow-red-900/20'
                                    : 'bg-slate-50 dark:bg-slate-800/30 border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800'}
                            `}
                        >
                            <h4 className={`font-bold text-sm mb-1 ${selected?.id === academy.id ? 'text-white' : 'text-slate-800 dark:text-slate-200 group-hover:text-red-500'}`}>
                                {academy.name}
                            </h4>
                            <div className={`flex items-start gap-1.5 text-[10px] font-medium leading-tight ${selected?.id === academy.id ? 'text-red-100' : 'text-slate-500'}`}>
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span>{academy.city} • {academy.address}</span>
                            </div>
                        </motion.div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="text-center py-10">
                            <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-400 text-xs font-medium">No se encontraron resultados</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area: Map + Detailed Sidebar */}
            <div className={`flex-1 relative bg-slate-100 dark:bg-slate-900 overflow-hidden flex ${viewMode === 'list' ? 'hidden lg:flex' : 'flex'}`}>

                <div className="flex-1 relative">
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%' }}
                        minZoom={4}
                        maxBounds={ARG_BOUNDS}
                        maxBoundsViscosity={1.0}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <SafeMapController center={mapCenter} zoom={mapZoom} viewMode={viewMode} />

                        {userLocation && (
                            <Marker
                                position={userLocation}
                                icon={createUserIcon()}
                                zIndexOffset={1000}
                            />
                        )}

                        <MarkerClusterGroup
                            chunkedLoading
                            maxClusterRadius={50}
                            showCoverageOnHover={false}
                            iconCreateFunction={createClusterIcon}
                        >
                            {academies.map(acc => (
                                acc.lat !== null && acc.lng !== null && (
                                    <Marker
                                        key={acc.id}
                                        position={[Number(acc.lat), Number(acc.lng)]}
                                        icon={createCustomIcon(selected?.id === acc.id)}
                                        eventHandlers={{
                                            click: () => handleSelect(acc)
                                        }}
                                    />
                                )
                            ))}
                        </MarkerClusterGroup>
                    </MapContainer>

                </div>

                {/* Detailed Right Sidebar (Drawer) */}
                <AnimatePresence mode="wait">
                    {selected && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute right-0 top-0 bottom-0 w-full md:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-[1001] shadow-[-10px_0_30px_rgba(0,0,0,0.1)] flex flex-col"
                        >
                            {/* Drawer Close Button */}
                            <button
                                onClick={() => setSelected(null)}
                                className="absolute top-4 left-4 z-10 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-full shadow-lg border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-colors group"
                            >
                                <X className="w-5 h-5 text-slate-500 group-hover:text-red-500" />
                            </button>

                            {/* Drawer Content */}
                            <div className="flex-1 overflow-y-auto scrollbar-hide">
                                {/* Header Image */}
                                <div className="h-48 relative bg-slate-100 dark:bg-slate-800">
                                    {selected.image_url ? (
                                        <Image src={selected.image_url} alt={selected.name} fill className="object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                            <MapPin className="w-12 h-12 opacity-10" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                                    <div className="absolute bottom-6 left-6 right-6">
                                        <p className="text-red-400 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Sede Oficial</p>
                                        <h3 className="text-white font-black text-2xl tracking-tight leading-none">{selected.name}</h3>
                                    </div>
                                </div>

                                <div className="p-6 space-y-8">
                                    {/* Description */}
                                    {selected.description && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Info className="w-4 h-4 text-red-500" />
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Acerca de</h4>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                                &ldquo;{selected.description}&rdquo;
                                            </p>
                                        </div>
                                    )}

                                    {/* Info Grid */}
                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-800/30">
                                                <MapPin className="w-5 h-5 text-red-500" />
                                            </div>
                                            <div>
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Dirección</h4>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 font-bold leading-tight">{selected.address}</p>
                                                <p className="text-xs text-slate-500">{selected.city}, Argentina</p>
                                            </div>
                                        </div>

                                        {selected.schedules && (
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-800/30">
                                                    <Clock className="w-5 h-5 text-rose-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Horarios</h4>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">{selected.schedules}</p>
                                                </div>
                                            </div>
                                        )}

                                        {selected.classes && (
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-800/30">
                                                    <Dumbbell className="w-5 h-5 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Clases</h4>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-bold">{selected.classes}</p>
                                                </div>
                                            </div>
                                        )}

                                        {selected.professors && (
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-800/30">
                                                    <GraduationCap className="w-5 h-5 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Profesores</h4>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-bold">{selected.professors}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center gap-3 w-full h-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 transition-all hover:-translate-y-0.5"
                                >
                                    <Navigation className="w-4 h-4" /> Cómo llegar
                                </a>
                                {selected.website_url && (
                                    <a
                                        href={selected.website_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-center gap-3 w-full h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black rounded-xl text-xs uppercase tracking-[0.2em] transition-all hover:bg-slate-50 dark:hover:bg-slate-700"
                                    >
                                        <ExternalLink className="w-4 h-4" /> Ver Sitio Web
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
