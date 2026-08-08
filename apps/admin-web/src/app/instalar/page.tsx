'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Download,
    Share,
    PlusSquare,
    Smartphone,
    CheckCircle2,
    Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePWAInstall } from '@/hooks/usePWAInstall'

export default function InstallPage() {
    const { canInstall, isInstalled, promptInstall } = usePWAInstall()
    const [os, setOs] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown')

    useEffect(() => {
        // Detección de OS: depende de `window`, solo puede resolverse en el cliente.
        const ua = window.navigator.userAgent.toLowerCase()
        const detected = /iphone|ipad|ipod/.test(ua)
            ? 'ios'
            : /android/.test(ua)
                ? 'android'
                : 'desktop'
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOs(detected)
    }, [])

    // El QR apunta a esta misma instalación, no a un dominio fijo de otra marca.
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : '')
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${baseUrl}/instalar`)}`

    return (
        /* Mismo fondo que el login: es la otra puerta de entrada del alumno, y
           conviene que se reconozca como parte de lo mismo. Va oscuro fijo, sin
           seguir el tema, igual que el login. */
        <div className="relative min-h-screen overflow-hidden bg-[#121113] text-[#F7F7F2] selection:bg-[#899878]/30">
            <Image
                src="/kuro-dojo.jpg"
                alt=""
                fill
                priority
                sizes="100vw"
                className="pointer-events-none object-cover object-bottom"
            />
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#121113]/70" />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                    backgroundImage:
                        'linear-gradient(#F7F7F2 1px, transparent 1px), linear-gradient(90deg, #F7F7F2 1px, transparent 1px)',
                    backgroundSize: '72px 72px',
                }}
            />

            <div className="relative z-10 max-w-xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center text-center">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                >
                    <div className="w-20 h-20 bg-gradient-to-br from-kuro-600 to-kuro-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-kuro-500/20 mx-auto mb-6">
                        <img src="/kuro-icon.png" alt="Kuro" className="w-12 h-12 rounded-xl" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-[#F7F7F2]">NUESTRA <span className="text-[#899878]">APP</span></h1>
                    <p className="text-[#A7ACA2] font-medium">Instalá nuestra aplicación oficial para una mejor experiencia en el Dojo.</p>
                </motion.div>

                {/* Status Card */}
                <AnimatePresence mode="wait">
                    {isInstalled ? (
                        <motion.div
                            key="installed"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full bg-kuro-500/10 border border-kuro-500/20 rounded-[2.5rem] p-8 mb-8"
                        >
                            <div className="w-16 h-16 bg-kuro-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-kuro-500/30">
                                <CheckCircle2 className="w-10 h-10 text-[#F7F7F2]" />
                            </div>
                            <h2 className="text-xl font-black mb-2 uppercase italic leading-tight">En unos minutos comenzará la descarga de tu app</h2>
                            <p className="text-[#899878] font-bold mb-0 text-sm">Ya podés cerrar esta ventana y buscar el ícono en tu pantalla de inicio.</p>
                        </motion.div>
                    ) : (
                        <div className="w-full space-y-6">

                            {/* Android / Desktop Prompt */}
                            {(canInstall || os === 'android' || os === 'desktop') && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 border border-white/12 rounded-[2.5rem] p-8 backdrop-blur-xl"
                                >
                                    <div className="flex items-center gap-4 mb-6 text-left">
                                        <div className="w-12 h-12 bg-kuro-500/20 rounded-2xl flex items-center justify-center text-[#899878]">
                                            <Download className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg uppercase tracking-tight italic">Descarga Directa</h3>
                                            <p className="text-[#A7ACA2] text-xs font-bold uppercase tracking-widest">Para Android y Chrome</p>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={promptInstall}
                                        className="w-full h-16 rounded-2xl bg-kuro-600 hover:bg-kuro-500 text-[#F7F7F2] font-black uppercase tracking-widest text-sm shadow-xl shadow-kuro-600/20 transition-all hover:scale-105 active:scale-95"
                                    >
                                        Instalar Aplicación
                                    </Button>

                                    {!canInstall && (
                                        <p className="mt-4 text-xs text-[#A7ACA2] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                            <Info className="w-4 h-4" /> Si el botón no funciona, buscalo en el menú del navegador
                                        </p>
                                    )}
                                </motion.div>
                            )}

                            {/* iOS Guide */}
                            {os === 'ios' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 border border-white/12 rounded-[2.5rem] p-8 backdrop-blur-xl text-left"
                                >
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-kuro-500/20 rounded-2xl flex items-center justify-center text-[#899878]">
                                            <Smartphone className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg uppercase tracking-tight italic">Instalar en iPhone</h3>
                                            <p className="text-[#A7ACA2] text-xs font-bold uppercase tracking-widest">Guía para Safari</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-[#899878] shrink-0">1</div>
                                            <p className="text-[#A7ACA2] text-sm font-medium">Toca el botón <span className="text-[#F7F7F2] font-bold inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-white/10 rounded-md"><Share className="w-3.5 h-3.5" /> Compartir</span> al pie del navegador.</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-[#899878] shrink-0">2</div>
                                            <p className="text-[#A7ACA2] text-sm font-medium">Desliza hacia arriba y selecciona <span className="text-[#F7F7F2] font-bold inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-white/10 rounded-md"><PlusSquare className="w-3.5 h-3.5" /> Agregar a inicio</span>.</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-[#899878] shrink-0">3</div>
                                            <p className="text-[#A7ACA2] text-sm font-medium">Dale a <span className="text-[#899878] font-black tracking-widest uppercase mx-1">Agregar</span> arriba a la derecha.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* QR Code (For desktop to mobile transfer) */}
                            {os === 'desktop' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 border border-white/12 rounded-[2.5rem] p-8 backdrop-blur-xl"
                                >
                                    <h3 className="font-black text-lg uppercase tracking-tight italic mb-6">Escaneá para bajar</h3>
                                    <div className="bg-white p-4 rounded-3xl w-48 h-48 mx-auto mb-6 shadow-2xl">
                                        <img src={qrUrl} alt="QR Code" className="w-full h-full" />
                                    </div>
                                    <p className="text-[#A7ACA2] text-xs font-bold uppercase tracking-widest">Apuntá tu cámara al código QR</p>
                                </motion.div>
                            )}

                        </div>
                    )}
                </AnimatePresence>

                {/* Footer removed */}
            </div>
        </div>
    )
}
