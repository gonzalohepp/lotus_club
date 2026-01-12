"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

type TimeSlot = {
  time: string
  available: boolean[]
}

type ConditioningSchedule = {
  type: "acondicionamiento"
  title: string
  description: string
  days: string[]
  times: TimeSlot[]
}

type MartialSchedule = {
  type: "martiales"
  title: string
  description: string
  days: string[]
  rows: string[][]
}

type Schedule = ConditioningSchedule | MartialSchedule

const schedules: Record<"acondicionamiento" | "martiales", Schedule> = {
  acondicionamiento: {
    type: "acondicionamiento",
    title: "Acondicionamiento Físico",
    description: "Entrenamiento funcional al máximo: fuerza, resistencia y movilidad.",
    days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
    times: [
      { time: "7:30", available: [true, false, true, false, true] },
      { time: "8:30", available: [true, true, true, true, true] },
      { time: "9:30", available: [true, false, true, false, true] },
      { time: "16:00", available: [false, true, false, true, false] },
      { time: "17:00", available: [true, true, true, true, true] },
      { time: "18:00", available: [true, true, true, true, true] },
      { time: "19:00", available: [true, false, true, false, true] },
      { time: "20:00", available: [false, true, false, true, false] },
    ],
  },
  martiales: {
    type: "martiales",
    title: "BJJ / Grappling / MMA / Judo",
    description:
      "Horarios de BJJ, Grappling, MMA y Judo organizados por día para todos los niveles.",
    days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
    rows: [
      ["", "BJJ 7:30–9:00", "", "BJJ 7:30–9:00", "", "Grappling 10:00–11:30"],
      ["", "", "", "", "", "BJJ Competitivo 12:00–13:30"],
      ["BJJ 16:30–18:00", "", "BJJ 16:30–18:00", "", "BJJ 16:30–18:00", ""],
      ["BJJ Kids 18:00–19:00", "", "BJJ Kids 18:00–19:00", "", "BJJ Kids 18:00–19:00", ""],
      ["MMA 19:00–20:00", "Grappling 19:00–20:30", "MMA 19:00–20:00", "Grappling 19:00–20:30", "MMA 19:00–20:00", ""],
      ["BJJ 20:00–21:30", "", "BJJ 20:00–21:30", "", "BJJ 20:00–21:30", ""],
      ["", "Judo 20:30–22:00", "", "Judo 20:30–22:00", "", ""],
    ],
  },
}

type ScheduleKey = keyof typeof schedules

export function ScheduleGrid() {
  const [activeTab, setActiveTab] = useState<ScheduleKey>("martiales")
  const currentSchedule = schedules[activeTab]

  // Para artes marciales: calculamos las clases por día (columna)
  const martialDays =
    currentSchedule.type === "martiales"
      ? currentSchedule.days.map((day, dayIndex) => {
        const classes = currentSchedule.rows
          .map((row) => row[dayIndex])
          .filter((cell) => cell && cell.trim().length > 0)
        return { day, classes }
      })
      : []

  return (
    <div>
      {/* Tabs */}
      <div className="flex justify-center gap-2 md:gap-4 mb-6 md:mb-8 flex-wrap">
        <Button
          onClick={() => setActiveTab("martiales")}
          className={`flex-1 sm:flex-none px-4 md:px-8 py-2 md:py-3 rounded-xl text-xs md:text-base font-semibold transition-all duration-300 ${activeTab === "martiales"
            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/50"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          type="button"
        >
          BJJ / MMA / Judo
        </Button>
        <Button
          onClick={() => setActiveTab("acondicionamiento")}
          className={`flex-1 sm:flex-none px-4 md:px-8 py-2 md:py-3 rounded-xl text-xs md:text-base font-semibold transition-all duration-300 ${activeTab === "acondicionamiento"
            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/50"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          type="button"
        >
          Acondicionamiento
        </Button>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-800 overflow-hidden">
          <CardContent className="p-4 md:p-8">
            <div className="text-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{currentSchedule.title}</h3>
              <p className="text-sm md:text-base text-slate-400">{currentSchedule.description}</p>
            </div>

            {/* ACONDICIONAMIENTO: queda en tabla como antes */}
            {currentSchedule.type === "acondicionamiento" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm md:text-base">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {currentSchedule.days.map((day) => (
                        <th
                          key={day}
                          className="p-3 text-center text-slate-300 font-semibold md:text-lg"
                        >
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSchedule.times.map((slot, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        {slot.available.map((isAvailable, dayIdx) => (
                          <td key={dayIdx} className="p-3 text-center align-middle">
                            {isAvailable ? (
                              <div className="bg-blue-600 rounded-lg py-2 md:py-3 px-2 md:px-4 text-white font-semibold md:text-lg">
                                {slot.time}
                              </div>
                            ) : (
                              <div className="text-slate-600 md:text-lg">—</div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // ARTES MARCIALES: cards por día
              <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-6">
                {martialDays.map(({ day, classes }) => (
                  <div
                    key={day}
                    className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4 flex flex-col gap-3 shadow-[0_0_25px_rgba(15,23,42,0.6)]"
                  >
                    <h4 className="text-sm font-semibold text-slate-100 text-center mb-1">
                      {day}
                    </h4>

                    {classes.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                        Sin clases
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {classes.map((cls, idx) => (
                          <div
                            key={idx}
                            className="bg-blue-600 rounded-lg py-2 px-3 text-[11px] md:text-xs text-white font-semibold text-center"
                          >
                            {cls}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}