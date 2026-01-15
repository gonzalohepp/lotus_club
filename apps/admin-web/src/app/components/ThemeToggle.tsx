'use client'

import { useState, useLayoutEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'

function getInitialTheme(): boolean {
    if (typeof window === 'undefined') return false
    const theme = localStorage.getItem('theme')
    return theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
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
            className="relative h-10 w-10 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-colors hover:ring-2 hover:ring-red-500/20"
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
                        <Moon className="w-5 h-5 text-red-500 fill-red-500 italic" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ y: 20, opacity: 0, rotate: -45 }}
                        animate={{ y: 0, opacity: 1, rotate: 0 }}
                        exit={{ y: -20, opacity: 0, rotate: 45 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Sun className="w-5 h-5 text-amber-500 fill-amber-500" />
                    </motion.div>
                )}
            </AnimatePresence>
        </button>
    )
}
