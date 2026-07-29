'use client'

import { useEffect } from 'react'

import { useTenant } from '@/lib/tenant/context'

/**
 * BrandStyle — Pinta la app con los colores de la organización activa.
 *
 * La app entera ya usa `bg-brand`, `text-brand`, `ring-brand`, etc., que en
 * globals.css apuntan a las variables `--brand`, `--brand-dark` y
 * `--brand-light`. En vez de tocar decenas de componentes, este componente
 * sobreescribe esas tres variables en el `<html>` y todo el árbol se repinta
 * solo.
 *
 * Los colores llegan como hex desde `/superadmin` (`<input type="color">` no
 * produce otra cosa), pero el tema está definido en oklch. Se convierte acá:
 * mezclar hex y oklch en la misma variable hace que las derivadas del tema
 * (`--primary`, `--ring`, `--sidebar-primary`) queden inconsistentes.
 */

/** sRGB hex → oklch. Devuelve null si el string no es un hex válido. */
function hexToOklch(hex: string): string | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
    if (!m) return null

    let h = m[1]
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]

    const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

    const r = toLinear(parseInt(h.slice(0, 2), 16) / 255)
    const g = toLinear(parseInt(h.slice(2, 4), 16) / 255)
    const b = toLinear(parseInt(h.slice(4, 6), 16) / 255)

    // sRGB lineal → LMS → Oklab (matrices de Björn Ottosson)
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m2 = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

    const L = 0.2104542553 * l + 0.793617785 * m2 - 0.0040720468 * s
    const A = 1.9779984951 * l - 2.428592205 * m2 + 0.4505937099 * s
    const B = 0.0259040371 * l + 0.7827717662 * m2 - 0.808675766 * s

    const C = Math.sqrt(A * A + B * B)
    const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360

    return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`
}

/** Variante más oscura/clara del mismo tono, para hover y fondos suaves. */
function shift(oklch: string, lightness: number, chromaScale = 1): string {
    const m = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(oklch)
    if (!m) return oklch
    const c = (parseFloat(m[2]) * chromaScale).toFixed(3)
    return `oklch(${lightness.toFixed(3)} ${c} ${m[3]})`
}

export default function BrandStyle() {
    // Se leen los valores CRUDOS, no `useTenant().branding`, que viene mergeado
    // con DEFAULT_BRANDING. Si usáramos el mergeado, toda organización sin
    // colores propios pisaría el tema con el default (#1E40AF → oklch 0.424,
    // bastante más oscuro que el oklch 0.676 de globals.css) y se vería
    // distinta de como se ve hoy. Sin marca configurada, no se toca nada.
    const { org, activeDojo } = useTenant()
    const primary = activeDojo?.branding?.primary || org?.branding?.primary
    const accent = activeDojo?.branding?.accent || org?.branding?.accent

    useEffect(() => {
        const root = document.documentElement

        // Sin color propio, se dejan las variables del tema por defecto.
        if (!primary) {
            root.style.removeProperty('--brand')
            root.style.removeProperty('--brand-dark')
            root.style.removeProperty('--brand-light')
            return
        }

        const base = hexToOklch(primary)
        if (!base) return

        const m = /oklch\(([\d.]+)/.exec(base)
        const L = m ? parseFloat(m[1]) : 0.68

        const isDark = root.classList.contains('dark')

        root.style.setProperty('--brand', base)
        root.style.setProperty('--brand-dark', shift(base, Math.max(L - 0.075, 0.2)))
        // El "light" es un fondo tenue: muy claro en tema claro, muy oscuro en
        // oscuro. Si no, los chips de marca quedan ilegibles en uno de los dos.
        root.style.setProperty(
            '--brand-light',
            isDark ? shift(base, 0.28, 0.4) : shift(base, 0.94, 0.22)
        )

        if (accent) {
            const acc = hexToOklch(accent)
            if (acc) root.style.setProperty('--brand-accent', acc)
        }
    }, [primary, accent])

    return null
}
