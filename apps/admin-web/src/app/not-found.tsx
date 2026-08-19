import Link from 'next/link'
import type { Metadata } from 'next'

/**
 * Página 404 propia.
 *
 * Sin este archivo Next muestra la suya, que está en inglés ("This page could
 * not be found") y sin la marca. Es server component: no necesita sesión ni
 * estado, y así no suma JS al bundle del cliente.
 */

export const metadata: Metadata = {
    title: 'Página no encontrada',
}

export default function NotFound() {
    return (
        <main className="min-h-screen bg-carbon-50 dark:bg-carbon-900 flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-md text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/kuro-wordmark.png"
                    alt="Kuro"
                    className="h-8 w-auto mx-auto mb-10 opacity-40 dark:invert-0 invert"
                />

                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-kuro-600 dark:text-kuro-400">
                    Error 404
                </p>

                <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
                    Esta página no existe
                </h1>

                <p className="mt-4 text-sm font-medium text-carbon-500 dark:text-carbon-400">
                    Puede que el enlace esté mal escrito o que la página se haya movido.
                    Revisá la dirección o volvé al inicio.
                </p>

                <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/admin"
                        className="inline-flex items-center justify-center rounded-2xl bg-kuro-600 px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-kuro-700"
                    >
                        Ir al panel
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-2xl border border-carbon-200 px-6 py-3 text-sm font-black uppercase tracking-widest text-carbon-700 transition-colors hover:bg-carbon-100 dark:border-white/10 dark:text-carbon-200 dark:hover:bg-white/5"
                    >
                        Volver al inicio
                    </Link>
                </div>
            </div>
        </main>
    )
}
