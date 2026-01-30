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
import AcademiesMapSection from "@/components/landing/AcademiesMapSection"

const navItems = [
  { label: "Inicio", id: "inicio" },
  { label: "¿Qué es BJJ?", id: "about-bjj" },
  { label: "Historia del BJJ", id: "history-bjj" },
  { label: "Historia de Lótus", id: "history-lotus" },
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
            <img
              src="/lotus_logo_full.png"
              alt="Lotus Club"
              className="h-10 md:h-12 w-auto brightness-0 transition-all duration-500 group-hover:scale-105"
            />
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
              Lotus Club - Donde la excelencia técnica se encuentra con el espíritu indomable.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => scrollToSection("about-bjj")}
                className="bg-white hover:bg-black text-black hover:text-white font-black uppercase tracking-widest px-10 py-8 rounded-full h-auto text-lg hover:scale-105 transition-transform"
              >
                Conocé más
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

      {/* QUE ES JIU-JITSU */}
      <section id="about-bjj" className="py-32 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-12">
              ¿QUÉ ES EL <br />
              <span className="text-white italic">JIU-JITSU?</span>
            </h2>
            <div className="space-y-8 text-white/70 text-lg md:text-xl leading-relaxed font-medium">
              <p>
                El jiu-jitsu brasileño (popularmente conocido también por sus siglas en inglés, BJJ) es un arte marcial, deporte de combate y sistema de defensa personal desarrollado en Brasil. Se centra principalmente en la lucha cuerpo a cuerpo en el suelo, usando para ello luxaciones, estrangulaciones, inmovilizaciones y derribos.
              </p>
              <div className="p-8 bg-white/5 border border-white/10 rounded-3xl italic">
                "El principal objetivo del jiu-jitsu brasileño es someter al rival mediante una luxación o estrangulación sin necesidad de usar golpes, de ahí que se le denomine a veces «arte suave»."
              </div>
              <p>
                Estas técnicas tienen su origen en el judo japonés, particularmente en su apartado de lucha en suelo conocido como ne waza, llevado a Brasil por los maestros Mitsuyo Maeda y Geo Omori. Estas técnicas fueron posteriormente adaptadas en su aspecto deportivo por la familia Gracie, transmitiéndolas a través de sucesivas generaciones.
              </p>
              <p>
                Este arte marcial está basado en la idea de que un individuo pequeño puede defenderse con éxito frente a un rival más grande y fuerte gracias al uso eficaz de la técnica, llevándolo al suelo, desgastándolo y finalmente sometiéndolo con una luxación o estrangulación.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HISTORIA JIU-JITSU */}
      <section id="history-bjj" className="py-32 bg-black overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-16">
            <div className="lg:col-span-5">
              <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-10">
                HISTORIA DEL <br />
                <span className="text-white italic">BJJ</span>
              </h2>
              <div className="sticky top-32">
                <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden border border-white/10 grayscale hover:grayscale-0 transition-all duration-700">
                  <img src="/lotus_club_hero_action_1768403416936.png" className="w-full h-full object-cover" alt="History" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-7 space-y-12 text-white/60 text-lg leading-relaxed pt-10">
              <div className="space-y-6">
                <h3 className="text-2xl font-black uppercase text-white tracking-widest">Orígenes Japoneses</h3>
                <p>
                  Los métodos de lucha cuerpo a cuerpo clásicos del Japón feudal, conocidos como jiu-jitsu (柔術) o jūjutsu se desarrollaron a lo largo de la época del Japón feudal (siglos VIII al XIX). Los samuráis desarrollaron técnicas de lanzamientos, luxaciones y derribos para enfrentar oponentes con armadura, donde los golpes resultaban poco efectivos.
                </p>
                <p>
                  En 1882, Jigorō Kanō fundó el judo (柔道) y la academia Kōdōkan, basándose en la escuela Kito-Ryu y Tenshin Shin´yo Ryu. El judo desplazó por su superioridad a otros tipos de jiu-jitsu tradicional basados solamente en formas y katas antiguos.
                </p>
              </div>

              <div className="space-y-6">
                <h3 className="text-2xl font-black uppercase text-white tracking-widest">La semilla en Brasil</h3>
                <p>
                  Mitsuyo Maeda, conocido como el "Conde Koma", fue uno de los grandes judokas del Kodokan que recorrieron el mundo aceptando retos. En 1914 llegó a Belem do Pará, Brasil, donde Gastão Gracie le ayudó en sus exhibiciones. Maeda aceptó entrenar a los hijos de Gastão como agradecimiento.
                </p>
              </div>

              <div className="space-y-6">
                <h3 className="text-2xl font-black uppercase text-white tracking-widest">El Legado Gracie</h3>
                <p>
                  En 1925 se abrió la primera academia de "Gracie Jiu-jitsu" en Río de Janeiro. Carlos Gracie y sus hermanos perfeccionaron las técnicas y desafiaban a cualquiera a un combate sin reglas para demostrar la eficacia del sistema. Hélio Gracie, dadas sus condiciones físicas, adaptó y perfeccionó aún más las técnicas para maximizar el uso de palancas y minimizar el esfuerzo físico.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HISTORIA LOTUS */}
      <section id="history-lotus" className="py-32 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none mb-6">
              HISTORIA DE <br />
              <span className="text-white italic underline decoration-white/20 underline-offset-8">LÓTUS</span>
            </h2>
            <p className="text-white/40 text-2xl font-medium max-w-2xl mx-auto">Tradición, Respeto y Calidad de Vida desde 1989.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-32">
            <div className="space-y-6 text-white/70 text-lg leading-relaxed">
              <p>
                Fundada el 19 de febrero de 1989 por los hermanos Moisés, Ali y Elias, en una época en la que el Jiu-Jitsu no era conocido como lo es hoy, Lótus siempre mantuvo la tradición familiar de sus miembros, priorizando la calidad de vida, el respeto y la solidaridad.
              </p>
              <p>
                El equipo de competencia de Lótus es reconocido como el mejor de São Paulo, ostentando el mayor número de títulos. Actualmente, Lótus Club ha trascendido fronteras, desarrollándose en países como Estados Unidos, Japón y Nueva Zelanda.
              </p>
            </div>
            <div className="p-10 bg-white border border-black/10 rounded-[3rem] shadow-2xl">
              <h3 className="text-3xl font-black text-black uppercase mb-6 leading-tight">Moisés Muradi</h3>
              <p className="text-black/70 mb-6 font-medium">
                Fundador de Lotus Club Jiu-Jitsu. Iniciado por Orlando Saraiva y graduado a cinturón negro por Otávio de Almeida.
              </p>
              <div className="pt-6 border-t border-black/10">
                <p className="text-black/60 text-sm font-bold uppercase tracking-widest">
                  Fundador de la primera Federación de Jiu-Jitsu de São Paulo y la CBJJE.
                </p>
              </div>
            </div>
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