'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Upload, Loader2, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import MapSelector from './MapSelector'
import Image from 'next/image'

type Academy = {
    id?: number
    name: string
    city: string
    address: string
    lat?: number
    lng?: number
    image_url?: string
    website_url?: string
    description?: string
    schedules?: string
    professors?: string
    classes?: string
}

export default function AcademyModal({
    isOpen,
    onClose,
    academy,
}: {
    isOpen: boolean
    onClose: () => void
    academy?: Academy | null
}) {
    const queryClient = useQueryClient()
    const [form, setForm] = useState<Academy>({
        name: '',
        city: '',
        address: '',
        lat: -34.6037, // Default BA
        lng: -58.3816,
        image_url: '',
        website_url: '',
        description: '',
        schedules: '',
        professors: '',
        classes: ''
    })
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [geocoding, setGeocoding] = useState(false)

    useEffect(() => {
        if (academy) {
            setForm({
                ...academy,
                lat: academy.lat ?? -34.6037,
                lng: academy.lng ?? -58.3816,
                description: academy.description ?? '',
                schedules: academy.schedules ?? '',
                professors: academy.professors ?? '',
                classes: academy.classes ?? ''
            })
            if (academy.image_url) setPreview(academy.image_url)
        } else {
            setForm({
                name: '',
                city: '',
                address: '',
                lat: -34.6037,
                lng: -58.3816,
                image_url: '',
                website_url: '',
                description: '',
                schedules: '',
                professors: '',
                classes: ''
            })
            setPreview(null)
        }
        setFile(null)
    }, [academy])

    const reverseGeocode = async (lat: number, lng: number) => {
        setGeocoding(true)
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            const data = await response.json()
            if (data && data.address) {
                const addressStr = [
                    data.address.road || '',
                    data.address.house_number || '',
                ].filter(Boolean).join(' ') || data.display_name.split(',')[0]

                const cityStr = data.address.city || data.address.town || data.address.suburb || data.address.village || ''

                setForm(s => ({
                    ...s,
                    lat,
                    lng,
                    address: addressStr || s.address,
                    city: cityStr || s.city
                }))
            } else {
                setForm(s => ({ ...s, lat, lng }))
            }
        } catch (e) {
            console.error('Reverse geocoding error:', e)
            setForm(s => ({ ...s, lat, lng }))
        } finally {
            setGeocoding(false)
        }
    }

    const uploadImage = async () => {
        if (!file) return form.image_url

        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('academy-images')
            .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('academy-images').getPublicUrl(filePath)
        return data.publicUrl
    }

    const mutation = useMutation({
        mutationFn: async (data: Academy) => {
            let imageUrl = data.image_url
            if (file) {
                setUploading(true)
                imageUrl = await uploadImage()
                setUploading(false)
            }

            const payload = { ...data, image_url: imageUrl }
            delete payload.id // Don't send ID if it's undefined or for update logic

            if (academy?.id) {
                const { error } = await supabase.from('academies').update(payload).eq('id', academy.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('academies').insert(payload)
                if (error) throw error
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['academies'] })
            onClose()
        },
        onError: (e) => {
            setUploading(false)
            alert('Error guardando: ' + (e as Error).message)
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        mutation.mutate(form)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
                {/* Left: Map */}
                <div className="w-full md:w-1/2 h-64 md:h-full relative bg-slate-100 dark:bg-slate-800">
                    <MapSelector
                        lat={form.lat}
                        lng={form.lng}
                        onLocationSelect={reverseGeocode}
                    />
                    <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-3 rounded-xl text-xs font-bold shadow-lg pointer-events-none z-[400] border border-slate-200 dark:border-slate-800">
                        {geocoding ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                <span>Autocompletando dirección...</span>
                            </div>
                        ) : (
                            <p>📍 Selecciona la ubicación para autocompletar</p>
                        )}
                    </div>
                </div>

                {/* Right: Form */}
                <div className="w-full md:w-1/2 flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900">
                        <h2 className="text-xl font-black text-slate-800 dark:text-white">
                            {academy ? 'Editar Academia' : 'Nueva Academia'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">

                        {/* Image Upload */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Imagen de portada</label>
                            <div
                                className="relative h-40 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors cursor-pointer overflow-hidden group"
                                onClick={() => document.getElementById('img-upload')?.click()}
                            >
                                {preview ? (
                                    <Image src={preview} alt="Preview" fill className="object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                        <Upload className="w-8 h-8 mb-2" />
                                        <span className="text-xs font-bold">Click para subir imagen</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <p className="text-white font-bold text-xs">Cambiar imagen</p>
                                </div>
                            </div>
                            <input
                                id="img-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) {
                                        setFile(f)
                                        setPreview(URL.createObjectURL(f))
                                    }
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nombre</label>
                                <input
                                    required
                                    className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:ring-2 ring-blue-500/20 outline-none transition-all"
                                    placeholder="Ej: Beleza Dojo Central"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Ciudad</label>
                                <input
                                    required
                                    className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:ring-2 ring-blue-500/20 outline-none transition-all"
                                    placeholder="Ej: Buenos Aires"
                                    value={form.city}
                                    onChange={e => setForm({ ...form, city: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Dirección</label>
                            <input
                                required
                                className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:ring-2 ring-blue-500/20 outline-none transition-all"
                                placeholder="Calle 123, Localidad"
                                value={form.address}
                                onChange={e => setForm({ ...form, address: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Descripción de la Academia</label>
                            <textarea
                                className="w-full h-24 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:ring-2 ring-blue-500/20 outline-none resize-none transition-all"
                                placeholder="Breve historia o información de la sede..."
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Horarios</label>
                                <textarea
                                    className="w-full h-32 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:ring-2 ring-blue-500/20 outline-none resize-none transition-all"
                                    placeholder="Lunes a Viernes 08:00 - 22:00..."
                                    value={form.schedules}
                                    onChange={e => setForm({ ...form, schedules: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Clases</label>
                                <textarea
                                    className="w-full h-32 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:ring-2 ring-blue-500/20 outline-none resize-none transition-all"
                                    placeholder="BJJ, Grappling, MMA, Judo..."
                                    value={form.classes}
                                    onChange={e => setForm({ ...form, classes: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Profesores</label>
                            <input
                                className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:ring-2 ring-blue-500/20 outline-none transition-all"
                                placeholder="Nombres de los profesores encargados..."
                                value={form.professors}
                                onChange={e => setForm({ ...form, professors: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sitio Web / Info URL</label>
                            <input
                                className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:ring-2 ring-blue-500/20 outline-none transition-all"
                                placeholder="https://..."
                                value={form.website_url ?? ''}
                                onChange={e => setForm({ ...form, website_url: e.target.value })}
                            />
                        </div>

                        <div className="pt-2 flex items-center gap-2 text-xs text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <p>Coords: {form.lat?.toFixed(6)}, {form.lng?.toFixed(6)}</p>
                        </div>

                    </form>

                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-4 bg-slate-50/30 dark:bg-slate-900">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={mutation.isPending || uploading || geocoding}
                            className="flex-[2] h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {(mutation.isPending || uploading || geocoding) && <Loader2 className="w-4 h-4 animate-spin" />}
                            {academy ? 'Guardar Cambios' : 'Crear Academia'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
