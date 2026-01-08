'use client'

import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts'
import { motion } from 'framer-motion'

const REVENUE_DATA = [
    { name: 'Lun', amount: 45000 },
    { name: 'Mar', amount: 52000 },
    { name: 'Mie', amount: 48000 },
    { name: 'Jue', amount: 61000 },
    { name: 'Vie', amount: 55000 },
    { name: 'Sab', amount: 42000 },
    { name: 'Dom', amount: 38000 },
]

const GROWTH_DATA = [
    { name: 'Ene', users: 120 },
    { name: 'Feb', users: 150 },
    { name: 'Mar', users: 185 },
    { name: 'Abr', users: 210 },
    { name: 'May', users: 245 },
    { name: 'Jun', users: 280 },
]

export default function DashboardCharts() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Crecimiento de Miembros */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-white/10 bg-white p-6 shadow-xl"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Crecimiento de Miembros</h3>
                    <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold font-mono">+15%</div>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={GROWTH_DATA}>
                            <defs>
                                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} hide />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                                itemStyle={{ color: '#60a5fa' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="users"
                                stroke="#3b82f6"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorUsers)"
                                animationDuration={2000}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* Ingresos Semanales */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-3xl border border-white/10 bg-white p-6 shadow-xl"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Ingresos Semanales</h3>
                    <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold font-mono">ARS</div>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={REVENUE_DATA}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} hide />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                            />
                            <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} animationDuration={1500}>
                                {REVENUE_DATA.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 3 ? '#6366f1' : '#3b82f6'} fillOpacity={0.8} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>
        </div>
    )
}
