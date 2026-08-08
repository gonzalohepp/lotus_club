'use client'

import { useState } from 'react'
import { Crosshair, Loader2, MapPin, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import MapSelector from '@/components/academies/MapSelector'

/**
 * DojoLocationPicker — Ubicación de una sede.
 *
 * El mapa de la landing sólo dibuja sedes con `lat`/`lng`: una dirección en
 * texto no alcanza para poner un pin. Este componente cierra ese hueco desde el
 * panel — escribís la dirección, la busca, y podés corregir el pin a mano.
 *
 * Funciona en los dos sentidos:
 *   · Dirección → mapa  (geocodificación, con el botón Buscar)
 *   · Mapa → dirección  (geocodificación inversa, al tocar el mapa)
 *
 * Ambas van contra Nominatim (OpenStreetMap): gratis y sin API key, coherente
 * con que el mapa ya usa tiles de OSM. A cambio admite ~1 request por segundo,
 * de ahí que la búsqueda sea por botón y no mientras se tipea.
 */

type Props = {
    address: string
    city: string
    lat: number | null
    lng: number | null
    onChange: (coords: { lat: number | null; lng: number | null }) => void
    /** Completa dirección y ciudad al marcar un punto en el mapa. */
    onAddressResolved: (fields: { address: string; city: string }) => void
}

/** Arma "Calle 1234" con lo que devuelva Nominatim, que no siempre trae todo. */
function formatStreet(a: Record<string, string | undefined>): string {
    return [a.road ?? a.pedestrian ?? a.footway, a.house_number].filter(Boolean).join(' ').trim()
}

/**
 * La localidad puede venir en distintos campos según la zona: en el AMBA suele
 * ser `town` o `suburb`, no `city`. Se toma el primero que exista.
 */
function formatCity(a: Record<string, string | undefined>): string {
    return a.city ?? a.town ?? a.village ?? a.suburb ?? a.city_district ?? a.county ?? ''
}

export default function DojoLocationPicker({
    address,
    city,
    lat,
    lng,
    onChange,
    onAddressResolved,
}: Props) {
    const [searching, setSearching] = useState(false)
    const [resolving, setResolving] = useState(false)

    const geocode = async () => {
        const query = [address, city, 'Argentina'].filter(Boolean).join(', ')

        if (!address && !city) {
            return toast.error('Cargá primero la dirección o la ciudad')
        }

        setSearching(true)
        try {
            const url = new URL('https://nominatim.openstreetmap.org/search')
            url.searchParams.set('q', query)
            url.searchParams.set('format', 'json')
            url.searchParams.set('limit', '1')

            const res = await fetch(url, {
                headers: { 'Accept-Language': 'es' },
            })
            const results = await res.json()

            if (!Array.isArray(results) || results.length === 0) {
                return toast.error('No se encontró esa dirección', {
                    description: 'Probá con la calle y altura, o marcá el punto a mano en el mapa.',
                })
            }

            const found = results[0]
            onChange({ lat: Number(found.lat), lng: Number(found.lon) })

            toast.success('Ubicación encontrada', {
                description: found.display_name?.slice(0, 90),
            })
        } catch {
            toast.error('No se pudo consultar el mapa', {
                description: 'Marcá el punto a mano tocando el mapa.',
            })
        } finally {
            setSearching(false)
        }
    }

    /**
     * Al tocar el mapa: se fija el pin al instante (respuesta inmediata) y
     * recién después se resuelve la dirección. Si Nominatim no contesta, las
     * coordenadas ya quedaron guardadas igual.
     */
    const handleMapClick = async (newLat: number, newLng: number) => {
        onChange({ lat: newLat, lng: newLng })

        setResolving(true)
        try {
            const url = new URL('https://nominatim.openstreetmap.org/reverse')
            url.searchParams.set('lat', String(newLat))
            url.searchParams.set('lon', String(newLng))
            url.searchParams.set('format', 'json')
            url.searchParams.set('addressdetails', '1')

            const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
            const data = await res.json()
            const parts = (data?.address ?? {}) as Record<string, string | undefined>

            const street = formatStreet(parts)
            const town = formatCity(parts)

            if (!street && !town) {
                return toast.info('Punto marcado', {
                    description: 'Ahí no hay una dirección conocida; cargala a mano.',
                })
            }

            // Se conserva lo que ya estaba si el reverse no trajo ese campo:
            // borrar una dirección escrita a mano sería peor que no completarla.
            onAddressResolved({ address: street || address, city: town || city })

            toast.success('Dirección completada', {
                description: [street, town].filter(Boolean).join(', '),
            })
        } catch {
            toast.info('Punto marcado', {
                description: 'No se pudo resolver la dirección; cargala a mano.',
            })
        } finally {
            setResolving(false)
        }
    }

    const hasCoords = lat != null && lng != null

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs">
                    <MapPin className={`w-4 h-4 ${hasCoords ? 'text-kuro-500' : 'text-warn-500'}`} />
                    {hasCoords ? (
                        <span className="font-mono text-carbon-500">
                            {lat!.toFixed(5)}, {lng!.toFixed(5)}
                        </span>
                    ) : (
                        <span className="font-bold text-warn-600 dark:text-warn-400">
                            Sin ubicación — esta sede no aparece en el mapa de la web
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={geocode}
                        disabled={searching}
                        className="flex items-center gap-2 px-4 h-9 rounded-xl bg-carbon-900 dark:bg-carbon-100 text-white dark:text-carbon-900 text-xs font-bold disabled:opacity-50 transition-opacity"
                    >
                        {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        Buscar por dirección
                    </button>

                    {hasCoords && (
                        <button
                            type="button"
                            onClick={() => onChange({ lat: null, lng: null })}
                            className="p-2 rounded-xl text-carbon-400 hover:text-alert-500 transition-colors"
                            title="Quitar la ubicación"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="h-72">
                <MapSelector
                    lat={lat ?? undefined}
                    lng={lng ?? undefined}
                    onLocationSelect={handleMapClick}
                />
            </div>

            <p className="flex items-center gap-1.5 text-[10px] text-carbon-500">
                {resolving ? (
                    <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Buscando la dirección de ese punto…
                    </>
                ) : (
                    <>
                        <Crosshair className="w-3 h-3" />
                        Tocá el mapa para mover el pin: la dirección y la ciudad se completan solas.
                    </>
                )}
            </p>
        </div>
    )
}
