"use client"

import { useState } from "react"
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
} from "lucide-react"
import { motion } from "framer-motion"
import { InstructorCarousel } from "./components/landing/InstructorCarousel"
import { ScheduleGrid } from "./components/landing/ScheduleGrid"

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
]

export default function HomeLandingPage() {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
      setIsMenuOpen(false)
    }
  }

  // 🔹 Punto único de entrada al sistema:
  // podés cambiar "/app" por "/validate" o "/login" si preferís.
  const handleAccess = () => {
    router.push("/app")
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo + nombre */}
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Beleza Dojo Logo"
                className="w-10 h-10 object-contain rounded-full"
              />
              <span className="text-2xl font-bold text-white">Beleza Dojo</span>
            </div>

            {/* Menu desktop */}
            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="text-slate-300 hover:text-white transition-colors duration-200 font-medium"
                  type="button"
                >
                  {item.label}
                </button>
              ))}
              <Button
                onClick={handleAccess}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                type="button"
              >
                Acceso
              </Button>
            </div>

            {/* Menu mobile toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-white p-2"
              type="button"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Menu mobile */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-slate-900 border-t border-slate-800"
          >
            <div className="px-4 py-4 space-y-3">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="block w-full text-left text-slate-300 hover:text-white transition-colors duration-200 py-2"
                  type="button"
                >
                  {item.label}
                </button>
              ))}
              <Button
                onClick={handleAccess}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                type="button"
              >
                Acceso
              </Button>
            </div>
          </motion.div>
        )}
      </nav>

      {/* HERO */}
      <section
        id="inicio"
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
      >
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('/beleza_fondo1.png')",
              filter: "blur(8px) brightness(0.3)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-blue-400 font-semibold mb-4 text-sm uppercase tracking-wider">
              Quilmes - Zona Sur - Artes Marciales
            </p>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Donde el entrenamiento
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                impulsa tu rendimiento
              </span>
            </h1>
            <p className="text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              En Beleza Dojo entrenás Jiu-Jitsu, Grappling, MMA, Judo y acondicionamiento físico
              en un ambiente de respeto, camaradería y disciplina. Desde principiantes hasta
              competidores.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-blue-600/50"
                size="lg"
              >
                <a
                  href="https://www.instagram.com/belezadojo"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Quiero probar una clase
                  <ChevronRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <Button
                onClick={() => scrollToSection("horarios")}
                variant="outline"
                className="bg-white text-blue-600 hover:bg-slate-100 text-lg px-10 py-6 rounded-xl shadow-2xl"
                size="lg"
                type="button"
              >
                Ver clases y horarios
              </Button>
            </div>
          </motion.div>
        </div>

        
      </section>

      {/* DÓNDE ESTAMOS */}
      <section id="donde-estamos" className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('/beleza_fondo4.png')",
              filter: "blur(10px) brightness(0.2)",
            }}
          />
          <div className="absolute inset-0 bg-slate-950/80" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Dónde estamos</h2>
            <p className="text-xl text-slate-300 flex items-center justify-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              Av Calchaquí 4335, Quilmes, Buenos Aires
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-800 overflow-hidden shadow-2xl">
              <CardContent className="p-0">
                <div className="relative">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3277.7022264486864!2d-58.2792986235246!3d-34.76309316593384!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95a32e9eef9c5603%3A0xe0b9320f38d1beb8!2sAv.%20Calchaqu%C3%AD%204335%2C%20B1879%20Quilmes%2C%20Provincia%20de%20Buenos%20Aires!5e0!3m2!1ses!2sar!4v1763061000312!5m2!1ses!2sar"
                    width="100%"
                    height="450"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full"
                  />
                  <div className="absolute bottom-4 right-4">
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=Av+Calchaquí+4335+Quilmes+Buenos+Aires"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-lg transition-colors duration-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir en Maps
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* HISTORIA */}
      <section id="historia" className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Nuestra historia</h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
              <CardContent className="p-8 md:p-12">
                <div className="space-y-6 text-slate-300 text-lg leading-relaxed">
                  <p>
                    El dojo surgió en agosto de 2011, en un gimnasio de Quilmes donde se enseñaban
                    artes marciales. Con el tiempo, el grupo necesitó una identidad propia, algo que
                    lo identificara como equipo. Después de muchas deliberaciones surgieron el
                    nombre y el logo.
                  </p>

                  <p>
                    <span className="text-blue-400 font-semibold">"Beleza"</span> es una expresión
                    muy usada en Brasil para decir que "está todo bien". Elegimos ese nombre para
                    reflejar el ambiente relajado y de camaradería que queremos en cada
                    entrenamiento.
                  </p>

                  <p>
                    Como logo adoptamos el{" "}
                    <span className="text-blue-400 font-semibold">"shaka"</span>, que representa
                    amistad, comprensión, compasión y solidaridad; valores que queremos transmitir
                    como equipo dentro y fuera del tatami.
                  </p>

                  <p>
                    Con el tiempo surgió la necesidad de tener un lugar propio, con más horarios e
                    instalaciones pensadas para brindar un entrenamiento integral a nuestros socios.
                    Así nació la idea de un centro de entrenamiento de artes marciales
                    especializado en el grappling.
                  </p>

                  <p>
                    Llegó la mudanza a nuestro primer dojo, las primeras inversiones en pisos de
                    goma y materiales de entrenamiento, y la suma de nuevos alumnos y profesores. De
                    a poco fuimos construyendo un lugar donde cualquier entusiasta de las artes
                    marciales puede encontrar su espacio.
                  </p>

                  <p className="text-white font-semibold text-xl">
                    Hoy, casi 13 años después, seguimos dando lo mejor para hacer de Beleza el mejor
                    dojo posible para aprender y entrenar artes marciales y deportes de combate en
                    toda Zona Sur.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* PROFESORES */}
      <section id="profesores" className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('/beleza_fondo1.png')",
              filter: "blur(10px) brightness(0.2)",
            }}
          />
          <div className="absolute inset-0 bg-slate-950/80" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Profesores</h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Entrenadores experimentados comprometidos con tu progreso
            </p>
          </motion.div>

          <InstructorCarousel />
        </div>
      </section>

      {/* HORARIOS */}
      <section id="horarios" className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Horarios Beleza</h2>
            <p className="text-xl text-slate-400">Entrená cuando mejor te convenga</p>
          </motion.div>

          <ScheduleGrid />
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('/beleza_fondo2.png')",
              filter: "blur(10px) brightness(0.2)",
            }}
          />
          <div className="absolute inset-0 bg-slate-950/80" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Contacto</h2>
            <p className="text-xl text-slate-300 mb-8">
              Escribinos para coordinar tu clase de prueba, resolver dudas sobre horarios o conocer
              más sobre el dojo.
            </p>
          </motion.div>

          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <motion.a
              href="https://wa.me/5491234567890"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg shadow-green-600/50 transition-all duration-200"
            >
              <MessageCircle className="w-6 h-6" />
              WhatsApp
            </motion.a>

            <motion.a
              href="https://www.instagram.com/belezadojo"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg shadow-purple-600/50 transition-all duration-200"
            >
              <Instagram className="w-6 h-6" />
              Instagram
            </motion.a>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('/beleza_fondo3.png')",
              filter: "blur(8px) brightness(0.4)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/80 via-cyan-900/70 to-blue-900/80" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              ¿Listo para empezar?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Probá una clase gratis y descubrí por qué somos el mejor dojo de la zona
            </p>
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-blue-600/50"
              size="lg"
            >
              <a
                href="https://www.instagram.com/belezadojo"
                target="_blank"
                rel="noopener noreferrer"
              >
                Quiero mi clase gratis
                <ChevronRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <img
                src="/logo.png"
                alt="Beleza Dojo Logo"
                className="w-10 h-10 object-contain rounded-full"
              />
              <span className="text-xl font-bold text-white">Beleza Dojo</span>
            </div>
            <p className="text-slate-400 text-center md:text-right">
              © {new Date().getFullYear()} Beleza Dojo. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}