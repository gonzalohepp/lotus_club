'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        // Check initial theme
        const theme = localStorage.getItem('theme')
        const dark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
        setIsDark(dark)
        if (dark) document.documentElement.classList.add('dark')
    }, [])

    const toggleTheme = () => {
        const next = !isDark
        setIsDark(next)
        if (next) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }
    }

    return (
        <button
            onClick={toggleTheme}
            className="relative h-10 w-10 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-colors hover:ring-2 hover:ring-blue-500/20"
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
                        <Moon className="w-5 h-5 text-blue-400 fill-blue-400 italic" />
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
