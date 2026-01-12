'use client'

import { useEffect, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

type Props = {
  onDecode: (text: string) => void
  onError?: (err: unknown) => void
  paused?: boolean
}

/**
 * Scanner HTML5 embebido en un contenedor fijo (no full screen).
 * Pausamos con pause(true) para evitar AbortError y NO removemos el <video>.
 */
export default function QRScannerHtml5({ onDecode, onError, paused = false }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const qrRef = useRef<Html5Qrcode | null>(null)
  const lockedRef = useRef(false)

  // -- CSS para el overlay futurista --
  const overlayStyles = `
    @keyframes scan-line {
      0% { transform: translateY(0); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(280px); opacity: 0; }
    }
    @keyframes pulse-corner {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    .qr-overlay-corner {
      position: absolute;
      width: 40px;
      height: 40px;
      border-color: #3b82f6;
      border-style: solid;
      animation: pulse-corner 2s ease-in-out infinite;
    }
  `


  useEffect(() => {
    let disposed = false
      ; (async () => {
        try {
          if (!hostRef.current) return
          // contenedor interno donde html5-qrcode va a inyectar el canvas/video
          const innerId = `${Math.random().toString(36).slice(2)}-qr`
          const inner = document.createElement('div')
          inner.id = innerId
          inner.style.width = '100%'
          inner.style.height = '100%'
          hostRef.current.innerHTML = ''
          hostRef.current.appendChild(inner)

          const qr = new Html5Qrcode(innerId, { verbose: false })
          qrRef.current = qr

          await qr.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 280, height: 280 },
              aspectRatio: 1,
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            (decodedText) => {
              if (lockedRef.current) return
              lockedRef.current = true
              try { qr.pause(true) } catch { }
              onDecode(decodedText)
            },
            () => { }
          )
        } catch (e) {
          onError?.(e)
        }
      })()

    return () => {
      disposed = true
        ; (async () => {
          try {
            if (qrRef.current?.isScanning) await qrRef.current.stop()
          } catch { }
          try {
            await qrRef.current?.clear()
          } catch { }
          qrRef.current = null
        })()
    }
  }, [onDecode, onError])

  // Pausar/Reanudar sin desmontar el video
  useEffect(() => {
    const qr = qrRef.current
    if (!qr) return
    try {
      if (paused) qr.pause(true)
      else {
        lockedRef.current = false
        qr.resume()
      }
    } catch (e) {
      onError?.(e)
    }
  }, [paused, onError])

  return (
    <div className="relative w-full max-w-[420px] mx-auto overflow-hidden rounded-3xl bg-slate-900/5 shadow-inner">
      <style>{overlayStyles}</style>

      {/* El host del scanner (video) */}
      <div
        ref={hostRef}
        className="w-full aspect-square"
      />

      {/* Capa de Overlay Estético */}
      {!paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* Fondo oscuro periférico (agujero de luz) */}
          <div className="absolute inset-0 bg-black/30"
            style={{ maskImage: 'radial-gradient(circle at center, transparent 130px, black 140px)', WebkitMaskImage: 'radial-gradient(circle at center, transparent 130px, black 140px)' }} />

          <div className="relative w-[280px] h-[280px]">
            {/* Esquinas */}
            <div className="qr-overlay-corner top-0 left-0 border-t-4 border-l-4 rounded-tl-lg" />
            <div className="qr-overlay-corner top-0 right-0 border-t-4 border-r-4 rounded-tr-lg" />
            <div className="qr-overlay-corner bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg" />
            <div className="qr-overlay-corner bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg" />

            {/* Línea de escaneo */}
            <div
              className="absolute left-4 right-4 h-0.5 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]"
              style={{ animation: 'scan-line 3s linear infinite' }}
            />
          </div>
        </div>
      )}

      {/* Overlay de pausa */}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-500">
          <div className="text-white text-center">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2 border border-white/30 backdrop-blur-md">
              <div className="w-3 h-8 bg-white rounded-full mx-1" />
              <div className="w-3 h-8 bg-white rounded-full mx-1" />
            </div>
            <p className="text-sm font-medium tracking-wide">PAUSADO</p>
          </div>
        </div>
      )}
    </div>
  )
}
