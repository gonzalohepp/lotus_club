"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChevronRight,
  Menu,
  X,
  MapPin,
  ExternalLink,
  MessageCircle,
  Instagram,
  Star,
  ArrowUp,
  Shield,
  Zap,
  Target,
  Trophy
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { InstructorCarousel } from "./components/landing/InstructorCarousel"
import { ScheduleGrid } from "./components/landing/ScheduleGrid"
import AcademiesMapSection from "@/components/landing/AcademiesMapSection"

const navItems = [
  { label: "Inicio", id: "inicio" },
  { label: "Academia", id: "academy" },
  { label: "Programas", id: "programs" },
  { label: "Profesores", id: "instructors" },
  { label: "Horarios", id: "horarios" },
  { label: "Sedes", id: "locations" },
]

export default function HomeLandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const navbarHeight = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - navbarHeight
      window.scrollTo({ top: offsetPosition, behavior: "smooth" })
      setIsMenuOpen(false)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/30">

      {/* MODERN FLOATING NAV */}
      <nav
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-500 w-[95%] max-w-5xl ${scrolled ? "top-4" : "top-8"
          }`}
      >
        <div className={`rounded-2xl border border-white/10 backdrop-blur-2xl px-6 py-3 flex items-center justify-between transition-all ${scrolled ? "bg-white shadow-2xl py-2" : "bg-white/90"
          }`}>
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => scrollToSection("inicio")}>
            <div className="relative w-14 h-14 rounded-2xl border border-black/10 bg-black/5 flex items-center justify-center overflow-hidden group-hover:border-black group-hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <img
                src="/lotus_logo_full.png"
                alt="Lotus Club"
                className="w-[200%] max-w-none brightness-0 relative transition-all duration-700 group-hover:scale-110"
                style={{ transform: 'translateY(-26%)' }}
              />
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-xs font-black uppercase tracking-[0.2em] text-black/60 hover:text-black transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          <button className="md:hidden text-black" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* MOBILE MENU */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 right-0 mt-4 bg-white border border-black/10 rounded-2xl p-6 backdrop-blur-3xl overflow-hidden md:hidden"
            >
              <div className="flex flex-col gap-6">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="text-2xl font-black uppercase tracking-tighter text-left text-black hover:text-black/70 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ASYMMETRICAL HERO */}
      <section id="inicio" className="relative min-h-screen flex items-center pt-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10 w-full">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-block px-4 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-black tracking-[0.3em] uppercase mb-8">
              La Evolución del Combate
            </div>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tight leading-[0.85] uppercase italic mb-8">
              LIBERA <br />
              <span className="text-white text-glow-white">TU</span> <br />
              FUERZA <br />
              INTERIOR
            </h1>
            <p className="text-white/60 text-lg md:text-xl max-w-md font-medium leading-relaxed mb-10">
              Entrenamiento de élite en Brazilian Jiu-Jitsu, MMA y Grappling en un ambiente diseñado para el alto rendimiento.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => window.open("https://wa.me/5491124041132", "_blank")}
                className="bg-white hover:bg-black text-black hover:text-white font-black uppercase tracking-widest px-10 py-8 rounded-full h-auto text-lg hover:scale-105 transition-transform"
              >
                Unite a la Tribu
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: 10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="absolute inset-0 bg-white/5 blur-[150px] rounded-full animate-pulse" />
            <img
              src="/stylized_red_lotus_1768403444922.png"
              alt="Lotus"
              className="relative w-full max-w-xl mx-auto drop-shadow-[0_0_50px_rgba(255,255,255,0.1)] animate-float grayscale brightness-200"
            />
          </motion.div>
        </div>
      </section>

      {/* BRAND ETHOS */}
      <section id="academy" className="py-32 bg-black">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
          <div className="order-2 md:order-1 relative h-[600px] rounded-[3rem] overflow-hidden border border-white/10 group">
            <img src="/lotus_club_hero_action_1768403416936.png" className="w-full h-full object-cover grayscale transition-all duration-1000" alt="Action" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
            <div className="absolute bottom-10 left-10">
              <p className="text-4xl font-black uppercase italic tracking-tighter italic">Respeto. <br />Disciplina. <br /><span className="text-white underline decoration-white/30">Poder.</span></p>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-10">
              MÁS QUE <br />UN GIMNASIO. <br />
              <span className="text-white italic">UN LEGADO.</span>
            </h2>
            <div className="space-y-6 text-white/50 text-lg leading-relaxed">
              <p>
                Fundado por <span className="text-white font-bold">Cristian Hein</span>, Lotus Club no se trata solo de técnicas de lucha. Es una filosofía de evolución constante.
              </p>
              <p>
                La flor de loto representa el surgimiento desde la lucha hacia la belleza y la fuerza. En cada lucha, en cada entrenamiento, encontramos nuestro camino a la excelencia.
              </p>
              <div className="pt-10 flex gap-12">
                <div>
                  <p className="text-4xl font-black text-white">10+</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Años de excelencia</p>
                </div>
                <div>
                  <p className="text-4xl font-black text-white">500+</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Alumnos formados</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO PROGRAMS */}
      <section id="programs" className="py-32 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4">Disciplinas Core</h2>
            <p className="text-white/40 text-xl font-medium">Diseñadas para el dominio en el mundo real.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 auto-rows-[300px]">
            <div className="md:col-span-2 bento-card p-10 flex flex-col justify-end group cursor-pointer lg:row-span-2">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Shield className="text-white mb-6 group-hover:scale-110 transition-transform" size={48} />
              <h3 className="text-3xl font-black uppercase italic mb-4">Brazilian Jiu-Jitsu</h3>
              <p className="text-white/50 max-w-sm">El arte suave. Domina el apalancamiento, el control y la sumisión. Nuestra base fundamental.</p>
            </div>
            <div className="bento-card p-8 group cursor-pointer">
              <Zap className="text-white mb-4 group-hover:rotate-12 transition-transform" size={32} />
              <h3 className="text-xl font-bold uppercase mb-2">Grappling</h3>
              <p className="text-white/40 text-sm">Intensidad No-Gi. Movimientos fluidos y transiciones explosivas.</p>
            </div>
            <div className="bento-card p-8 group cursor-pointer bg-white">
              <Target className="text-black mb-4" size={32} />
              <h3 className="text-xl font-black uppercase mb-2 text-black">MMA</h3>
              <p className="text-black/60 text-sm font-medium">La integración definitiva. Golpea, lucha y domina.</p>
            </div>
            <div className="bento-card p-8 group cursor-pointer">
              <Trophy className="text-white mb-4 group-hover:scale-125 transition-transform" size={32} />
              <h3 className="text-xl font-bold uppercase mb-2">Judo</h3>
              <p className="text-white/40 text-sm">Domina el arte de los derribos. Precisión y poder tradicional.</p>
            </div>
          </div>
        </div>
      </section>

      {/* MODERN INSTRUCTORS */}
      <section id="instructors" className="py-32 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none italic mb-6">Staff Técnico</h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">Entrená con expertos dedicados a tu progresión diaria.</p>
          </div>
          <InstructorCarousel />
        </div>
      </section>

      {/* SCHEDULE */}
      <section id="horarios" className="py-32 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-10 mb-20">
            <div>
              <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-4">Horarios de <span className="text-white underline decoration-white/20">Entrenamiento</span></h2>
              <p className="text-white/40 text-xl">Encontrá tu momento para evolucionar.</p>
            </div>
            <Button className="bg-white text-black font-black uppercase tracking-widest px-8 py-6 rounded-full h-auto hover:bg-black hover:text-white transition-all shadow-xl">Descargar PDF</Button>
          </div>
          <div className="bg-zinc-900/50 p-4 md:p-10 rounded-[3rem] border border-white/5 shadow-2xl backdrop-blur-xl">
            <ScheduleGrid />
          </div>
        </div>
      </section>

      {/* LOCATIONS */}
      <section id="locations" className="py-32 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4">Nuestras Sedes</h2>
            <div className="flex items-center justify-center gap-2 text-white/60 font-bold uppercase tracking-widest text-sm">
              <MapPin size={20} />
              <span>Buenos Aires, Argentina</span>
            </div>
          </div>
          <div className="rounded-[4rem] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(255,255,255,0.05)]">
            <AcademiesMapSection minimal={true} />
          </div>
        </div>
      </section>

      {/* FINAL CALL */}
      <section className="py-40 relative overflow-hidden bg-black">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <motion.div
            whileInView={{ opacity: 1, scale: 1 }}
            initial={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-6xl md:text-[10rem] font-black uppercase tracking-tighter leading-none mb-12">
              SIN MÁS <br /><span className="text-white italic underline decoration-white/10 underline-offset-8">EXCUSAS.</span>
            </h2>
            <div className="flex flex-col items-center gap-8">
              <p className="text-white/40 text-2xl font-medium max-w-2xl">Empezá tu transformación hoy. Tu primera clase de prueba es por nuestra cuenta.</p>
              <Button
                onClick={() => window.open("https://www.instagram.com/lotusclub_ar", "_blank")}
                className="bg-white text-black hover:bg-black hover:text-white text-2xl font-black px-16 py-10 rounded-full h-auto transition-all shadow-2xl"
              >
                Reservar Clase de Prueba
              </Button>
            </div>
          </motion.div>
        </div>
        <div className="absolute bottom-[-100px] left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-white/5 blur-[120px] rounded-full" />
      </section>

      {/* FOOTER LUXURY */}
      <footer className="py-20 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-20">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-8 cursor-pointer group" onClick={() => scrollToSection("inicio")}>
                <img src="/lotus_logo_full.png" alt="Lotus Club" className="h-28 w-auto brightness-0 invert opacity-100 transition-all duration-500 hover:scale-105" />
              </div>
              <p className="text-white/40 max-w-xs text-lg font-medium leading-relaxed">
                Elevando vidas a través de la excelencia en artes marciales. El centro de entrenamiento de combate líder en Zona Sur.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white underline mb-6">Navegación</h4>
              <div className="flex flex-col gap-4 text-white/50 font-bold uppercase text-[10px] tracking-widest">
                <button onClick={() => scrollToSection("inicio")}>Inicio</button>
                <button onClick={() => scrollToSection("academy")}>Academia</button>
                <button onClick={() => scrollToSection("horarios")}>Horarios</button>
                <button onClick={() => scrollToSection("instructors")}>Equipo</button>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white underline mb-6">Seguinos</h4>
              <div className="flex flex-col gap-4 text-white/50 font-bold uppercase text-[10px] tracking-widest">
                <a href="https://www.instagram.com/lotusclub_ar" target="_blank">Instagram</a>
                <a href="https://wa.me/5491124041132" target="_blank">WhatsApp</a>
                <p className="mt-4 text-white/30 capitalize tracking-normal italic font-medium">Av. Calchaquí 4335, Buenos Aires</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center pt-10 border-t border-white/5 gap-6">
            <p className="text-white/20 text-xs font-bold uppercase tracking-widest">© {new Date().getFullYear()} Lotus Club International. Engineered by Antigravity.</p>
            <div className="flex gap-8 text-[10px] uppercase font-black tracking-[0.2em] text-white/20">
              <button className="hover:text-white transition-colors">Privacidad</button>
              <button className="hover:text-white transition-colors">Términos</button>
            </div>
          </div>
        </div>
      </footer>

      {/* SCROLL TOP */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-10 right-10 z-50 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl border border-black/10 active:scale-95 transition-transform"
          >
            <ArrowUp className="w-6 h-6 text-black" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>

  )
}