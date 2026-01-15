"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const instructors = [
  {
    id: 1,
    name: "Cristian Hein",
    role: "Fundador y Head Coach",
    photo:
      "/cristian.png",
    description:
      "Faixa preta de Brazilian Jiu-Jitsu y fundador de Lotus Club. Apasionado por enseñar y crear un ambiente de respeto, disciplina y camaradería.",
    specialties: ["Brazilian Jiu-Jitsu", "Grappling", "Judo"],
  },
  {
    id: 2,
    name: "Profesor Invitado",
    role: "Instructor de MMA",
    photo:
      "/lotus_fondo1.png",
    description:
      "Instructor especializado en MMA  con experiencia en campeonatos y en la formación de alumnos desde niveles iniciales.",
    specialties: ["MMA"],
  },
  {
    id: 3,
    name: "Profe Grappling",
    role: "Instructor de Grappling",
    photo:
      "/lotus_fondo2.png",
    description:
      "Enfocado en Grappling competitivo, estrategias de combate y preparación para torneos nacionales e internacionales.",
    specialties: ["Grappling", "Defensa Personal", "Técnicas Avanzadas"],
  },
]

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
    scale: 0.8,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
    scale: 0.8,
  }),
}

const swipeConfidenceThreshold = 10000

const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity
}

export function InstructorCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)

  const paginate = (newDirection: number) => {
    setDirection(newDirection)
    setCurrentIndex((prevIndex) => {
      let nextIndex = prevIndex + newDirection
      if (nextIndex < 0) nextIndex = instructors.length - 1
      if (nextIndex >= instructors.length) nextIndex = 0
      return nextIndex
    })
  }

  const current = instructors[currentIndex]

  return (
    <div className="relative">
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(_e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x)

              if (swipe < -swipeConfidenceThreshold) {
                paginate(1)
              } else if (swipe > swipeConfidenceThreshold) {
                paginate(-1)
              }
            }}
            className="w-full"
          >
            <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="p-0">
                <div className="grid md:grid-cols-2 gap-0">
                  {/* Foto */}
                  <div className="relative h-80 md:h-96 overflow-hidden">
                    <div
                      className="absolute inset-0 bg-black transform transition-transform duration-700 hover:scale-110 flex items-center justify-center"
                    >
                      {current.photo && !current.photo.includes('fondo') ? (
                        <img src={current.photo} alt={current.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-zinc-800">
                          <span className="text-6xl">🥋</span>
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

                    {/* Especialidades */}
                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                      {current.specialties.map((specialty, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-red-600/90 backdrop-blur-sm text-white text-xs font-semibold rounded-full"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-8 md:p-10 flex flex-col justify-center">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="mb-4">
                        <h3 className="text-3xl font-bold text-white mb-2">{current.name}</h3>
                        <p className="text-red-400 font-semibold text-lg">{current.role}</p>
                      </div>

                      <p className="text-slate-300 text-lg leading-relaxed mb-6">
                        {current.description}
                      </p>

                      {/* Dots */}
                      <div className="flex gap-2">
                        {instructors.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setDirection(index > currentIndex ? 1 : -1)
                              setCurrentIndex(index)
                            }}
                            className={`h-2 rounded-full transition-all duration-300 ${index === currentIndex
                              ? "w-8 bg-red-500"
                              : "w-2 bg-slate-600 hover:bg-slate-500"
                              }`}
                            aria-label={`Ver instructor ${index + 1}`}
                            type="button"
                          />
                        ))}
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Flechas */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => paginate(-1)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/60 backdrop-blur-xl hover:bg-red-600 text-white border border-white/10 w-14 h-14 rounded-full shadow-2xl transition-all"
        type="button"
      >
        <ChevronLeft className="w-8 h-8" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => paginate(1)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/60 backdrop-blur-xl hover:bg-red-600 text-white border border-white/10 w-14 h-14 rounded-full shadow-2xl transition-all"
        type="button"
      >
        <ChevronRight className="w-8 h-8" />
      </Button>
    </div>
  )
}