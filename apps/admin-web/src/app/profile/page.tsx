'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '../layouts/AdminLayout'
import {
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  GraduationCap,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Zap,
  Camera,
  Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'


type MemberRow = {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  access_code: string | null
  membership_type: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | null
  next_payment_due: string | null
  status?: 'activo' | 'inactivo'
  avatar_url?: string | null
}

type ClassRow = {
  id: number
  name: string
  instructor: string | null
  color: 'blue' | 'red' | 'green' | 'purple' | 'orange' | 'pink' | string | null
  price: number | string | null
  days: string[] | null
  start_time: string | null
  end_time: string | null
}

const en2es: Record<string, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mie', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
}

type AttendanceRow = {
  scanned_at: string
  result: string
  reason: string | null
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(`${d}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function daysDiff(a: Date, b: Date) { a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.round((b.getTime() - a.getTime()) / 86400000) }
function money(v: number | string | null) { const n = typeof v === 'string' ? Number(v) : v ?? 0; return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }) }
function scheduleStr(days: string[] | null, start?: string | null, end?: string | null) {
  const dias = (days ?? []).map(d => en2es[d.toLowerCase().slice(0, 3)] ?? d)
  const base = dias.length ? dias.join(', ') : '—'
  const t = (v?: string | null) => v ? new Date(`1970-01-01T${v}`).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''
  return (start || end) ? `${base} – ${t(start)}${end ? ` a ${t(end)}` : ''}` : base
}
const statusPill = (ok: boolean) => ok ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
const colorBadge: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-200', red: 'bg-red-100 text-red-800 border-red-200',
  green: 'bg-green-100 text-green-800 border-green-200', purple: 'bg-purple-100 text-purple-800 border-purple-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200', pink: 'bg-pink-100 text-pink-800 border-pink-200',
}

export default function ProfilePage() {
  const [member, setMember] = useState<MemberRow | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [emergency, setEmergency] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [notLogged, setNotLogged] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      const email = auth?.user?.email ?? null
      if (!email) { setNotLogged(true); setLoading(false); return }

      const { data: vw } = await supabase
        .from('members_with_status').select('*').ilike('email', email).maybeSingle()
      if (!vw) { setMember(null); setLoading(false); return }

      const { data: prof } = await supabase
        .from('profiles').select('emergency_phone, avatar_url').eq('user_id', vw.user_id).maybeSingle()

      setMember({ ...vw, avatar_url: prof?.avatar_url } as MemberRow)
      setEmergency(prof?.emergency_phone ?? null)

      const { data: enr } = await supabase
        .from('class_enrollments')
        .select('class_id, classes:class_id (id,name,instructor,color,price,days,start_time,end_time)')
        .eq('user_id', vw.user_id)
      setClasses(((enr ?? []) as any[]).map(r => r.classes).filter(Boolean))

      const { data: att } = await supabase
        .from('access_logs')
        .select('scanned_at, result, reason')
        .eq('user_id', vw.user_id)
        .order('scanned_at', { ascending: false })
        .limit(10)
      setAttendance(att ?? [])

      setLoading(false)
    })()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) return
      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `${member?.user_id}/${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', member?.user_id)

      if (updateError) throw updateError

      setMember(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
      alert('Foto actualizada correctamente')
    } catch (error: any) {
      alert(error.message)
    } finally {
      setUploading(false)
    }
  }

  const fullName = useMemo(() => [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim(), [member])
  const isActive = useMemo(() => member?.next_payment_due ? new Date(`${member.next_payment_due}T00:00:00`) >= new Date(new Date().toDateString()) : false, [member])
  const daysLeft = useMemo(() => member?.next_payment_due ? daysDiff(new Date(), new Date(`${member.next_payment_due}T00:00:00`)) : null, [member])

  // ---- Render dentro de AdminLayout para tener side menu ----
  return (
    <AdminLayout active="/profile">
      <div className="relative min-h-screen">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <div className="min-h-[70vh] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                    <UserIcon className="w-12 h-12 text-blue-600 animate-pulse" />
                  </div>
                  <p className="text-slate-500 font-bold text-xl uppercase tracking-widest animate-pulse">Cargando Perfil...</p>
                </div>
              </div>
            ) : notLogged || !member ? (
              <div className="min-h-[70vh] flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-12 text-center shadow-2xl backdrop-blur-xl"
                >
                  <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                  <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">Acceso Restringido</h2>
                  <p className="text-slate-500 text-lg">No pudimos encontrar tu información de perfil. Por favor, verificá tu sesión o contactá a recepción.</p>
                </motion.div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-blue-500/40 transform group-hover:rotate-2 transition-transform">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-12 h-12 text-white" />
                        )}

                        <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-[2px]">
                          <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
                          {uploading ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
                        </label>
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-lg">
                        <Zap className="w-4 h-4 text-amber-500 fill-current" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none mb-2">
                        Hola, <span className="text-blue-600">{member.first_name || 'Miembro'}</span>
                      </h1>
                      <p className="text-slate-500 text-lg font-medium flex items-center gap-2">
                        {member.email} • {member.membership_type === 'monthly' ? 'Miembro Mensual' : 'Socio VIP'}
                      </p>
                    </div>
                  </div>
                  <div className="px-6 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código de Acceso</p>
                      <p className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{member.access_code}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <Zap className="w-5 h-5" />
                    </div>
                  </div>
                </header>

                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Left Column: Cards */}
                  <div className="lg:col-span-2 space-y-8">
                    {/* Status Info */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <motion.div
                        whileHover={{ y: -4 }}
                        className="p-6 rounded-3xl border border-white/10 bg-white shadow-xl"
                      >
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Activity className="w-3 h-3" />
                          ESTADO DE MEMBRESÍA
                        </p>
                        <div className="flex items-end justify-between">
                          <div>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-4 ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                              {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {isActive ? 'Activo' : 'Vencido'}
                            </div>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter">
                              {isActive ? 'Membresía al día' : 'Pago pendiente'}
                            </p>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        whileHover={{ y: -4 }}
                        className="p-6 rounded-3xl border border-white/10 bg-white shadow-xl"
                      >
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          PRÓXIMO VENCIMIENTO
                        </p>
                        <div>
                          <p className="text-3xl font-black text-slate-900 tracking-tighter mb-4">
                            {fmtDate(member.next_payment_due)}
                          </p>
                          {daysLeft !== null && (
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: daysLeft > 0 ? `${Math.min(100, (daysLeft / 30) * 100)}%` : '0%' }}
                                className={`h-full rounded-full ${daysLeft < 7 ? 'bg-red-500' : 'bg-blue-600'}`}
                              />
                            </div>
                          )}
                          <p className="text-xs font-bold text-slate-400 mt-2">
                            {daysLeft !== null ? (
                              daysLeft > 0 ? `Quedan ${daysLeft} días de entrenamiento` : 'Tu tiempo ha expirado'
                            ) : 'Sin fecha definida'}
                          </p>
                        </div>
                      </motion.div>
                    </div>

                    {/* Classes Section */}
                    <div className="space-y-6">
                      <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-blue-600" />
                        Mis Clases Inscritas
                      </h2>
                      {classes.length === 0 ? (
                        <div className="p-12 text-center rounded-3xl border-2 border-dashed border-slate-200">
                          <p className="text-slate-400 font-bold italic uppercase tracking-widest">No estás en clases todavía</p>
                        </div>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                          {classes.map((c, idx) => (
                            <motion.div
                              key={c.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="group p-5 rounded-3xl bg-white border border-slate-100 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all"
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: c.color || '#3b82f6' }}>
                                  <Zap className="w-5 h-5" />
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo mensual</p>
                                  <p className="text-lg font-black text-slate-900">{money(c.price)}</p>
                                </div>
                              </div>
                              <h3 className="text-xl font-black text-slate-900 leading-tight mb-2 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{c.name}</h3>
                              {c.instructor && (
                                <p className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-1.5 uppercase tracking-tighter">
                                  <UserIcon className="w-3.5 h-3.5" />
                                  Sensei: {c.instructor}
                                </p>
                              )}
                              <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                                <Calendar className="w-3.5 h-3.5" />
                                {scheduleStr(c.days, c.start_time, c.end_time)}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Attendance & Profile */}
                  <div className="space-y-8">
                    {/* Attendance History */}
                    <div className="space-y-6">
                      <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        Mi Asistencia
                      </h2>
                      <div className="p-1 rounded-3xl bg-slate-50 border border-slate-100">
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                          {attendance.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic">Sin registros aún</div>
                          ) : (
                            <div className="space-y-2 p-2">
                              {attendance.map((att, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4"
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${att.result?.toLowerCase().includes('autorizado') || att.result?.toLowerCase().includes('success') ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                    }`}>
                                    {att.result?.toLowerCase().includes('autorizado') || att.result?.toLowerCase().includes('success') ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-black text-slate-900">{new Date(att.scanned_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</p>
                                      <p className="text-[10px] font-bold text-slate-400">{new Date(att.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                      {att.result?.toLowerCase().includes('autorizado') || att.result?.toLowerCase().includes('success') ? 'Acceso correcto' : 'DENEGADO'}
                                    </p>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Info & Emergency */}
                    <div className="p-8 rounded-3xl border border-white/10 bg-white shadow-xl space-y-6">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        Info de Contacto
                      </h3>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</p>
                        <p className="font-bold text-slate-900">{member.phone || 'No registrado'}</p>
                      </div>
                      <div className="pt-6 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Emergencias</p>
                        <p className="font-black text-red-600 uppercase tracking-tight">{emergency || 'Sin contacto definido'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
