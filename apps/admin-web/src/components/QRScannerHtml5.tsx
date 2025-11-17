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

  useEffect(() => {
    let disposed = false
    ;(async () => {
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
            // Caja de lectura cuadrada; el video se queda dentro del wrapper
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1,
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          },
          (decodedText) => {
            if (lockedRef.current) return
            lockedRef.current = true
            try { qr.pause(true) } catch {}
            onDecode(decodedText)
          },
          () => {}
        )
      } catch (e) {
        onError?.(e)
      }
    })()

    return () => {
      disposed = true
      ;(async () => {
        try {
          if (qrRef.current?.isScanning) await qrRef.current.stop()
        } catch {}
        try {
          await qrRef.current?.clear()
        } catch {}
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
    <div
      ref={hostRef}
      // 👇 límite visual del scanner (no ocupa todo)
      style={{
        width: '100%',
        maxWidth: 420,
        height: 420,
        margin: '0 auto',
        background: 'rgba(0,0,0,0.04)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    />
  )
}
