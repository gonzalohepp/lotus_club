'use client'

import React, { useState, useCallback } from 'react'
import Cropper, { Point, Area } from 'react-easy-crop'
import { motion } from 'framer-motion'
import { X, Check, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import getCroppedImg from '@/lib/cropUtils'

interface PhotoCropperProps {
    image: string
    onCancel: () => void
    onCropComplete: (croppedImage: Blob) => void
}

export default function PhotoCropper({ image, onCancel, onCropComplete }: PhotoCropperProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [loading, setLoading] = useState(false)

    const onCropChange = (crop: Point) => {
        setCrop(crop)
    }

    const onCropCompleteCallback = useCallback((_unpArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const onZoomChange = (zoom: number) => {
        setZoom(zoom)
    }

    const handleCrop = async () => {
        try {
            setLoading(true)
            if (croppedAreaPixels) {
                const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation)
                if (croppedImage) {
                    onCropComplete(croppedImage)
                }
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative w-full max-w-2xl bg-carbon-900 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl flex flex-col h-[80vh] md:h-[70vh]"
            >
                {/* Header */}
                <div className="p-6 flex items-center justify-between border-b border-white/5 bg-carbon-900/50 backdrop-blur-md relative z-10">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Ajustar Foto</h3>
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-full bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Cropper Container */}
                <div className="relative flex-1 bg-black">
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteCallback}
                        onZoomChange={onZoomChange}
                        style={{
                            containerStyle: {
                                background: '#000',
                            },
                        }}
                    />
                </div>

                {/* Controls */}
                <div className="p-6 bg-carbon-900/80 backdrop-blur-md border-t border-white/5 space-y-6">
                    <div className="flex flex-col gap-4">
                        {/* Zoom Slider */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-black text-carbon-400 uppercase tracking-widest px-1">
                                <span className="flex items-center gap-1.5"><ZoomOut className="w-3 h-3" /> Zoom</span>
                                <span>{Math.round(zoom * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => onZoomChange(Number(e.target.value))}
                                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-kuro-500"
                            />
                        </div>

                        {/* Rotation Controls */}
                        <div className="flex items-center justify-between pt-2">
                            <button
                                onClick={() => setRotation((r) => r - 90)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-carbon-300 hover:text-white hover:bg-white/10 transition-all text-xs font-black uppercase tracking-widest"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Girar
                            </button>

                            <div className="flex gap-3">
                                <Button
                                    onClick={onCancel}
                                    variant="outline"
                                    className="rounded-2xl border-white/10 bg-transparent text-white hover:bg-white/5 px-6 font-bold uppercase tracking-widest text-xs"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleCrop}
                                    disabled={loading}
                                    className="rounded-2xl bg-kuro-600 hover:bg-kuro-500 text-white px-8 font-black uppercase tracking-widest text-xs shadow-lg shadow-kuro-500/20"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Procesando
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Check className="w-4 h-4" /> Guardar
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
