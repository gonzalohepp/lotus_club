'use client'

import { useState, useLayoutEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'

/** El claro es el tema principal: sólo se va a oscuro por elección explícita,
 *  no por la preferencia del sistema operativo. Tiene que coincidir con el
 *  script anti-parpadeo de `layout.tsx`. */
function getInitialTheme(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('theme') === 'dark'
}

export default function ThemeToggle() {
    const [isDark, setIsDark] = useState(getInitialTheme)

    useLayoutEffect(() => {
        // Sync DOM with state (this is allowed - updating external system)
        if (isDark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [isDark])

    const toggleTheme = useCallback(() => {
        setIsDark(prev => {
            const next = !prev
            localStorage.setItem('theme', next ? 'dark' : 'light')
            return next
        })
    }, [])

    return (
        <button
            onClick={toggleTheme}
            className="relative h-10 w-10 overflow-hidden rounded-xl flex items-center justify-center transition-colors hover:bg-white dark:hover:bg-carbon-800"
            aria-label="Cambiar tema"
        >
            <AnimatePresence mode="wait">
                {isDark ? (
                    <motion.div
                        key="moon"
                        initial={{ y: 20, opacity: 0, rotate: -45 }}
                        animate={{ y: 0, opacity: 1, rotate: 0 }}
                        exit={{ y: -20, opacity: 0, rotate: 45 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Moon className="w-5 h-5 text-kuro-400 fill-kuro-400 italic" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ y: 20, opacity: 0, rotate: -45 }}
                        animate={{ y: 0, opacity: 1, rotate: 0 }}
                        exit={{ y: -20, opacity: 0, rotate: 45 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Sun className="w-5 h-5 text-warn-500 fill-warn-500" />
                    </motion.div>
                )}
            </AnimatePresence>
        </button>
    )
}
