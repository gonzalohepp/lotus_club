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
  ArrowUp
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { InstructorCarousel } from "./components/landing/InstructorCarousel"
import { ScheduleGrid } from "./components/landing/ScheduleGrid"
import AcademiesMapSection from "@/components/landing/AcademiesMapSection"

type NavItem = {
  label: string
  id: string
}

const navItems: NavItem[] = [
  { label: "Inicio", id: "inicio" },
  { label: "Dónde estamos", id: "donde-estamos" },
  { label: "Nuestra historia", id: "historia" },
  { label: "Profesores", id: "profesores" },
  { label: "Horarios", id: "horarios" },
  { label: "Contacto", id: "contacto" },
  { label: "Afiliación", id: "afiliacion" },
]

export default function HomeLandingPage() {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeTab, setActiveTab] = useState("infantil")
  const [showScrollTop, setShowScrollTop] = useState(false)

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const navbarHeight = 80

      const doScroll = () => {
        const elementPosition = element.getBoundingClientRect().top
        const offsetPosition = elementPosition + window.scrollY - navbarHeight

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        })
      }

      if (isMenuOpen) {
        setIsMenuOpen(false)
        // Wait for menu close animation to finish (300ms match transition)
        setTimeout(doScroll, 300)
      } else {
        doScroll()
      }
    }
  }

  const handleAccess = () => {
    router.push("/app")
  }

  const trackEvent = async (eventType: string, metadata?: Record<string, unknown>) => {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const _supabase = createClient(supabaseUrl, supabaseKey)

      await _supabase.from('landing_events').insert({
        event_type: eventType,
        metadata
      })
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    trackEvent('page_view', { referrer: document.referrer })

    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30 selection:text-white">
      {/* NAVBAR */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 border-b ${scrolled
          ? "bg-slate-950/80 backdrop-blur-xl border-slate-800 py-2"
          : "bg-transparent border-transparent py-4"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative group cursor-pointer" onClick={() => scrollToSection("inicio")}>
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
                <img
                  src="/logo.png"
                  alt="Beleza Dojo Logo"
                  className="relative w-10 h-10 object-contain rounded-full shadow-2xl"
                />
              </div>
              <span className="text-2xl font-black text-white tracking-tight cursor-pointer" onClick={() => scrollToSection("inicio")}>
                Beleza <span className="text-blue-500">Dojo</span>
              </span>
            </div>

            {/* Menu Desktop */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white uppercase tracking-wider hover:bg-white/5 rounded-lg transition-all text-center leading-tight max-w-[120px]"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="hidden lg:flex items-center">
              <Button
                onClick={() => {
                  trackEvent('click_access')
                  handleAccess()
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-105 hover:shadow-blue-500/40"
              >
                ACCESO
              </Button>
            </div>

            {/* Mobile Toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-slate-950 border-t border-slate-800 overflow-hidden"
            >
              <div className="px-4 py-6 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      scrollToSection(item.id)
                    }}
                    className="block w-full text-left px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-bold uppercase tracking-wider"
                  >
                    {item.label}
                  </button>
                ))}
                <div className="pt-4 px-4">
                  <Button
                    onClick={() => {
                      trackEvent('click_access')
                      handleAccess()
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-900/40"
                  >
                    ACCESO
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO SECTION */}
      <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/beleza_fondo1.png')" }}
          />
          {/* Overlay Gradient Premium */}
          <div className="absolute inset-0 bg-slate-950/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950/40 to-slate-950" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md mb-8"
          >

            <span className="text-blue-200 text-xs font-bold uppercase tracking-widest">
              Quilmes - Zona Sur - Artes Marciales
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 leading-tight tracking-tight"
          >
            TU POTENCIAL <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 animate-gradient-x">
              NO TIENE LÍMITES
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-300 mb-10 max-w-3xl mx-auto font-medium leading-relaxed"
          >
            Entrená con los mejores en <span className="text-blue-400 font-bold">Quilmes</span>.
            Jiu-Jitsu, Grappling, MMA y Judo en un ambiente diseñado para tu evolución.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold px-8 py-7 rounded-2xl shadow-xl shadow-blue-600/30 transition-all hover:scale-105 hover:-translate-y-1"
              onClick={() => trackEvent('click_wsp_hero')}
            >
              <a href="https://www.instagram.com/belezadojo" target="_blank" rel="noopener noreferrer">
                Quiero mi clase de prueba
                <ChevronRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
            <Button
              onClick={() => scrollToSection("horarios")}
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20 text-lg font-bold px-8 py-7 rounded-2xl backdrop-blur-sm transition-all"
            >
              Ver horarios y clases
            </Button>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >

          <div className="w-px h-12 bg-gradient-to-b from-blue-500/50 to-transparent" />
        </motion.div>
      </section>

      {/* DÓNDE ESTAMOS */}
      <section id="donde-estamos" className="relative py-32 overflow-hidden bg-slate-950">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">DÓNDE ESTAMOS</h2>
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <MapPin className="w-5 h-5" />
              <p className="text-xl font-medium text-slate-300">Av. Calchaquí 4335, Quilmes Oeste</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl p-1 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl"
          >
            <div className="relative rounded-[20px] overflow-hidden aspect-video md:aspect-[21/9] border border-slate-700/50">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3277.7022264486864!2d-58.2792986235246!3d-34.76309316593384!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95a32e9eef9c5603%3A0xe0b9320f38d1beb8!2sAv.%20Calchaqu%C3%AD%204335%2C%20B1879%20Quilmes%2C%20Provincia%20de%20Buenos%20Aires!5e0!3m2!1ses!2sar!4v1763061000312!5m2!1ses!2sar"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "grayscale(1) invert(1) contrast(1.2) brightness(0.8)" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute bottom-6 right-6">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Av+Calchaquí+4335+Quilmes+Buenos+Aires"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-black/50 hover:scale-105 transition-all flex items-center gap-2"
                  onClick={() => trackEvent('click_maps')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir en Google Maps
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HISTORIA */}
      <section id="historia" className="relative py-32 bg-slate-900 overflow-hidden">
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 uppercase tracking-tight">Nuestra Historia</h2>
            <div className="w-24 h-1.5 bg-blue-600 mx-auto rounded-full" />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-slate-950/50 backdrop-blur-xl border border-white/5 p-8 md:p-12 rounded-3xl relative overflow-hidden group hover:border-blue-500/30 transition-colors duration-500"
          >
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] group-hover:bg-blue-600/20 transition-colors" />

            <div className="space-y-8 text-lg text-slate-300 leading-relaxed relative z-10">
              <p>
                Todo comenzó en <span className="text-blue-400 font-bold">Agosto de 2011</span>, en un pequeño gimnasio de Quilmes. Un grupo de apasionados necesitaba una identidad. Así nació Beleza.
              </p>
              <p>
                <span className="text-white font-black text-xl">"BELEZA"</span> — expresión brasileña para decir que "está todo bien". Elegimos este nombre para reflejar el ambiente de camaradería y respeto que se respira en cada entrenamiento, sin perder la intensidad.
              </p>
              <p>
                Nuestro símbolo es el <span className="text-white font-black text-xl">"SHAKA"</span> 🤙. Representa amistad, comprensión y solidaridad. Valores innegociables dentro y fuera del tatami.
              </p>
              <div className="pl-6 border-l-4 border-blue-500 py-2 italic text-slate-400">
                "Hoy, más de una década después, seguimos con la misma pasión, construyendo el mejor centro de entrenamiento de combate de Zona Sur."
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PROFESORES */}
      <section id="profesores" className="relative py-32 overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">PROFESORES</h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Guiados por la experiencia, dedicados a tu evolución técnica y personal.
            </p>
          </div>
          <InstructorCarousel />
        </div>
      </section>

      {/* HORARIOS */}
      <section id="horarios" className="relative py-32 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tight">Horarios</h2>
            <p className="text-xl text-slate-400">Encontrá tu momento para entrenar</p>
          </div>
          <div className="bg-slate-950 p-1 md:p-2 rounded-[2.5rem] shadow-2xl border border-slate-800">
            <ScheduleGrid />
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="relative py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/beleza_fondo3.png')] bg-cover bg-center grayscale opacity-10 blur-[4px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-slate-950" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tight">CONTACTO</h2>
            <p className="text-xl md:text-2xl text-slate-300 mb-12">
              ¿Tenés dudas? Escribinos para coordinar tu clase de prueba o conocer más sobre nuestros planes.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <a
                href="https://wa.me/5491124041132"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-5 rounded-2xl font-bold text-lg shadow-lg shadow-green-900/20 transition-all hover:-translate-y-1"
                onClick={() => trackEvent('click_whatsapp')}
              >
                <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                Hablar por WhatsApp
              </a>

              <a
                href="https://www.instagram.com/belezadojo"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-5 rounded-2xl font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:-translate-y-1"
                onClick={() => trackEvent('click_instagram')}
              >
                <Instagram className="w-6 h-6 group-hover:scale-110 transition-transform" />
                Seguinos en Instagram
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* AFILIACIÓN LOTUS (VERTICAL FULL-WIDTH REDESIGN) */}
      <section id="afiliacion" className="relative py-32 md:py-48 overflow-hidden bg-slate-950">
        {/* Background elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[350px] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[url('/lotus_bg.png')] bg-contain bg-center bg-no-repeat opacity-10 blur-[8px] pointer-events-none" />
          <div className="absolute top-1/4 -right-20 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 -left-20 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] mix-blend-overlay" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.8,
                  staggerChildren: 0.2
                }
              }
            }}
            className="flex flex-col items-center text-center space-y-12 mb-20"
          >
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col items-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black tracking-[0.3em] uppercase mb-6 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                Red Global de Excelencia
              </span>
              <h2 className="text-6xl md:text-9xl font-black text-white leading-[0.8] tracking-tighter mb-8">
                LOTUS <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-600">CLUB</span>
              </h2>
              <div className="w-32 h-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-full" />
            </motion.div>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              className="text-2xl md:text-3xl text-slate-300 font-medium leading-relaxed max-w-4xl"
            >
              <span className="text-white">Beleza Dojo</span> es una sede oficial afiliada a la red global de <br className="hidden md:block" />
              <strong className="text-blue-400 font-black">LOTUS CLUB BRAZILIAN JIU JITSU</strong>.
            </motion.p>

            <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl">
              <motion.div
                variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                className="group relative"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
                <div className="relative bg-slate-900/40 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl overflow-hidden h-full">
                  <div className="text-slate-200 flex items-start gap-6 relative z-10 text-left">
                    <div className="p-4 bg-blue-600/20 rounded-2xl text-blue-400 shrink-0 shadow-inner">
                      <Star className="w-8 h-8 fill-blue-500/20" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-lg uppercase tracking-tight mb-2">Prestigio Internacional</h4>
                      <p className="text-slate-400 leading-relaxed text-sm">
                        Formamos parte de una de las redes más prestigiosas del mundo, con sedes en Brasil, USA, Europa y Argentina. Tu graduación tiene validez internacional.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0 } }}
                className="group relative"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
                <div className="relative bg-slate-900/40 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl overflow-hidden h-full">
                  <div className="text-slate-200 flex items-start gap-6 relative z-10 text-left">
                    <div className="p-4 bg-cyan-600/20 rounded-2xl text-cyan-400 shrink-0 shadow-inner">
                      <ExternalLink className="w-8 h-8" />
                    </div>
                    <div className="flex flex-col justify-between h-full">
                      <div>
                        <h4 className="text-white font-bold text-lg uppercase tracking-tight mb-2">Sede Oficial</h4>
                        <p className="text-slate-400 leading-relaxed text-sm mb-4">
                          Accedé a seminarios internacionales, técnicas exclusivas y el soporte de maestros de élite mundial.
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="link"
                        className="text-blue-400 hover:text-blue-300 p-0 h-auto font-black text-xs uppercase tracking-widest justify-start"
                      >
                        <a href="https://www.lotusclubusa.com/" target="_blank" rel="noopener noreferrer">
                          Visitar Sitio Oficial <ChevronRight className="w-4 h-4 ml-1" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Full Width Map Container */}
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          viewport={{ once: true }}
          className="relative w-full max-w-[1920px] mx-auto px-4"
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500/20 to-cyan-500/20 blur-3xl rounded-[3rem] opacity-50 group-hover:opacity-75 transition duration-1000" />
            <div className="relative rounded-[2.5rem] md:rounded-[4rem] p-1.5 md:p-3 bg-gradient-to-b from-slate-800 to-slate-900 shadow-[0_0_80px_rgba(30,58,138,0.2)] border border-white/10 overflow-hidden">
              <div className="rounded-[2rem] md:rounded-[3.5rem] overflow-hidden">
                <AcademiesMapSection minimal={true} />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* CTA FINAL */}
      <section className="relative py-32 overflow-hidden bg-blue-900">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('/beleza_fondo3.png')] bg-cover bg-center mix-blend-overlay" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 opacity-90" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-8 leading-tight">
            TU PRIMERA CLASE <br />ES GRATIS
          </h2>
          <p className="text-xl text-blue-100/80 mb-10 max-w-2xl mx-auto">
            No esperes más. Vení a conocer nuestra comunidad y viví la experiencia Beleza desde adentro.
          </p>
          <Button
            asChild
            className="bg-white text-blue-900 hover:bg-slate-100 text-xl font-black px-10 py-8 rounded-2xl shadow-2xl transition-transform hover:scale-105"
          >
            <a href="https://www.instagram.com/belezadojo" target="_blank" rel="noopener noreferrer">
              QUIERO EMPEZAR HOY
            </a>
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Beleza Logo" className="w-12 h-12 object-contain grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500" />
              <div className="text-left">
                <span className="block text-lg font-black text-slate-500 uppercase tracking-widest">Beleza Dojo</span>
                <span className="text-xs text-slate-600 block">Evolución constante</span>
              </div>
            </div>
            <p className="text-slate-600 text-sm font-medium">
              © {new Date().getFullYear()} Beleza Dojo. Quilmes, Buenos Aires.
            </p>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {
          showScrollTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl shadow-blue-500/40 flex items-center justify-center transition-colors group active:scale-95 border border-white/20"
              aria-label="Volver arriba"
            >
              <ArrowUp className="w-6 h-6 group-hover:-translate-y-1 transition-transform duration-300" />
            </motion.button>
          )
        }
      </AnimatePresence>
    </div>
  )
}