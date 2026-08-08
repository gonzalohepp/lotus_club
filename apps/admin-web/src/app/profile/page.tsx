'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '../layouts/AdminLayout'
import {
  User as UserIcon,
  Calendar,
  GraduationCap,
  AlertCircle,
  ShieldCheck,
  Clock,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Camera,
  Loader2,
  Shield,
  Plus,
  Edit2,
  Save as SaveIcon,
  X,
  ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import SubscriptionModal from '../components/profile/SubscriptionModal'
import PhotoCropper from '../components/profile/PhotoCropper'
import MemberGrades from '../components/profile/MemberGrades'
import { fmtARS, fmtDate, fmtSchedule } from '@/lib/format'
import { billingMessage, evaluateBilling } from '@/lib/billing'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'


type MemberRow = {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  access_code: string | null
  next_payment_due: string | null
  expires_at?: string | null
  status?: string | null
  avatar_url?: string | null
  role?: 'admin' | 'member' | 'instructor' | 'becado' | null
}

type ClassRow = {
  id: number
  name: string
  instructor: string | null
  color: 'blue' | 'red' | 'green' | 'purple' | 'orange' | 'pink' | string | null
  price_principal: number | null
  price_additional: number | null
  price: number | string | null
  days: string[] | null
  start_time: string | null
  end_time: string | null
  is_principal?: boolean
}

type AttendanceRow = {
  scanned_at: string
  result: string
  reason: string | null
  classes?: { name: string }[]
}

function getClassEmoji(name: string) {
  const n = name.toLowerCase()
  if (n.includes('fisico') || n.includes('acondicionamiento')) return '💪'
  if (n.includes('mma')) return '🥊'
  if (n.includes('grappling')) return '🤼'
  if (n.includes('bjj') || n.includes('jiu') || n.includes('judo') || n.includes('kids')) return '🥋'
  return '🥋'
}

function daysDiff(a: Date, b: Date) {
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/* ============ Bottom Sheet ============ */
function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-carbon-900 rounded-t-[32px] shadow-2xl max-h-[85vh] flex flex-col lg:hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-carbon-200 dark:bg-carbon-700" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 shrink-0 border-b border-carbon-100 dark:border-carbon-800">
              <h3 className="text-lg font-black text-carbon-900 dark:text-white uppercase tracking-tight">{title}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-carbon-100 dark:bg-carbon-800 flex items-center justify-center text-carbon-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ============ Section Button (Mobile) ============ */
function SectionButton({
  icon,
  label,
  sublabel,
  onClick,
  accent = 'blue',
}: {
  icon: React.ReactNode
  label: string
  sublabel?: string
  onClick: () => void
  accent?: 'blue' | 'emerald' | 'purple'
}) {
  const accents = {
    blue: 'bg-kuro-50 dark:bg-kuro-900/20 text-kuro-600 dark:text-kuro-400',
    emerald: 'bg-kuro-50 dark:bg-kuro-900/20 text-kuro-600 dark:text-kuro-400',
    purple: 'bg-kuro-50 dark:bg-kuro-900/20 text-kuro-600 dark:text-kuro-400',
  }
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-carbon-800/60 border border-carbon-100 dark:border-carbon-700 shadow-sm active:scale-[0.98] transition-all hover:shadow-md"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accents[accent]}`}>
        {icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="font-black text-carbon-900 dark:text-white text-sm uppercase tracking-tight">{label}</p>
        {sublabel && <p className="text-xs text-carbon-400 font-medium mt-0.5 truncate">{sublabel}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-carbon-300 shrink-0" />
    </button>
  )
}

/* ============ Class Card ============ */
function ClassItem({ c, idx }: { c: ClassRow; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.08 }}
      className="p-4 rounded-2xl bg-carbon-50 dark:bg-carbon-800/50 border border-carbon-100 dark:border-carbon-700"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm bg-white dark:bg-carbon-700">
          {getClassEmoji(c.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-carbon-900 dark:text-white uppercase tracking-tight leading-tight truncate text-sm">{c.name}</h3>
          {c.instructor && (
            <p className="text-[10px] font-bold text-carbon-400 uppercase tracking-widest truncate">
              {c.instructor}
            </p>
          )}
        </div>
        <p className="text-sm font-black text-carbon-900 dark:text-white shrink-0">
          {fmtARS(c.is_principal ? (c.price_principal ?? c.price) : (c.price_additional ?? c.price_principal ?? c.price))}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-kuro-600 dark:text-kuro-400 font-black text-[10px] uppercase tracking-widest">
        <Calendar className="w-3 h-3" />
        {fmtSchedule(c.days, c.start_time, c.end_time)}
      </div>
    </motion.div>
  )
}

/* ============ Main Page ============ */
export default function ProfilePage() {
  // El alumno ve su ficha EN LA SEDE ACTIVA: si entrena en dos, su cuota, sus
  // clases y su historial de ingresos son distintos en cada una.
  const { can, mercadoPago, activeDojo, billing, isPlatformAdmin, orgRole } = useTenant()
  const dojoId = activeDojo?.id
  const [member, setMember] = useState<MemberRow | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [emergency, setEmergency] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [notLogged, setNotLogged] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ phone: '', emergency: '' })
  const [isSaving, setIsSaving] = useState(false)

  // Bottom sheets
  const [sheetClases, setSheetClases] = useState(false)
  const [sheetAsistencia, setSheetAsistencia] = useState(false)
  const [sheetGraduaciones, setSheetGraduaciones] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      const email = auth?.user?.email ?? null
      if (!email) { setNotLogged(true); setLoading(false); return }

      const { data: vw } = await supabase
        .from('members_with_status').select('*')
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .ilike('email', email).maybeSingle()
      if (!vw) { setMember(null); setLoading(false); return }

      const { data: prof } = await supabase
        .from('profiles').select('emergency_phone, avatar_url').eq('user_id', vw.user_id).maybeSingle()

      setMember({ ...vw, avatar_url: prof?.avatar_url } as MemberRow)
      setEmergency(prof?.emergency_phone ?? null)
      setEditForm({ phone: vw.phone ?? '', emergency: prof?.emergency_phone ?? '' })

      const { data: enr } = await supabase
        .from('class_enrollments')
        .select('class_id, is_principal, classes:class_id (id,name,instructor,color,price,price_principal,price_additional,days,start_time,end_time)')
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .eq('user_id', vw.user_id)

      const mappedClasses = ((enr ?? []) as unknown[]).map((r: unknown) => {
        const row = r as { classes: ClassRow; is_principal: boolean }
        return { ...row.classes, is_principal: row.is_principal }
      }).filter(c => c.id)
      setClasses(mappedClasses)

      const { data: att } = await supabase
        .from('access_logs')
        .select('scanned_at, result, reason')
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .eq('user_id', vw.user_id)
        .order('scanned_at', { ascending: false })
        .limit(10)

      if (att && att.length > 0) {
        const earliest = att[att.length - 1].scanned_at.split('T')[0]
        const { data: classAtt } = await supabase
          .from('class_attendance')
          .select('date, created_at, classes(name)')
          .eq('dojo_id', dojoId ?? NO_DOJO)
          .eq('user_id', vw.user_id)
          .gte('date', earliest)

        const merged = att.map(a => {
          const date = a.scanned_at.split('T')[0]
          const matches = (classAtt || [])
            .filter(ca => ca.date === date)
            .flatMap(ca => (Array.isArray(ca.classes) ? ca.classes : ca.classes ? [ca.classes] : []) as { name: string }[])
          return { ...a, classes: matches }
        })
        setAttendance(merged)
      } else {
        setAttendance([])
      }

      setLoading(false)
    })()
  }, [dojoId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.addEventListener('load', () => setTempImage(reader.result as string))
    reader.readAsDataURL(file)
  }

  const handleApplyCrop = async (blob: Blob) => {
    try {
      setUploading(true)
      setTempImage(null)
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth?.user?.id
      if (!userId) throw new Error('No authenticated user found')
      const filePath = `${userId}/${Math.random()}.jpg`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', userId)
      if (updateError) throw updateError
      setMember(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
      setShowSuccessModal(true)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error desconocido'
      toast.error('Error al actualizar la foto', { description: msg })
    } finally {
      setUploading(false)
    }
  }

  const handleSaveInfo = async () => {
    try {
      if (!member) return
      setIsSaving(true)
      const { error } = await supabase.from('profiles').update({ phone: editForm.phone, emergency_phone: editForm.emergency }).eq('user_id', member.user_id)
      if (error) throw error
      setMember(prev => prev ? { ...prev, phone: editForm.phone } : null)
      setEmergency(editForm.emergency)
      setIsEditing(false)
      toast.success('Información actualizada correctamente')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error desconocido'
      toast.error('Error al guardar los cambios', { description: msg })
    } finally {
      setIsSaving(false)
    }
  }

  const fullName = useMemo(() => [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim(), [member])
  // La view SQL ya calcula el status correcto incluyendo período de gracia
  // No replicamos esa lógica aquí para evitar inconsistencias
  const isActive = useMemo(() => member?.status === 'activo', [member?.status])

  const daysLeft = useMemo(() =>
    member?.next_payment_due ? daysDiff(new Date(), new Date(`${member.next_payment_due}T00:00:00`)) : null,
    [member]
  )

  const isSpecialRole = member?.role && ['admin', 'instructor', 'becado'].includes(member.role)
  const isLifetime = member?.next_payment_due === '2099-12-31'

  /**
   * Mensaje de estado de cuota derivado de las reglas de ESTA sede. Antes salía
   * de `getPaymentStatusMessage()`, que tenía "día 10" y "20%" fijos: a un
   * alumno de una sede con otra política le mostraba números que no eran los
   * suyos.
   */
  const paymentStatusMessage = useMemo(() => {
    const result = evaluateBilling(billing, {
      endDate: member?.next_payment_due,
      isNewMember: (member as { is_new_member?: boolean } | null)?.is_new_member ?? false,
      role: member?.role,
      timezone: activeDojo?.timezone,
    })

    if (result.phase === 'al_dia' && (daysLeft ?? 0) > 0 && !isSpecialRole && !isLifetime) {
      return `Quedan ${daysLeft} días de entrenamiento`
    }
    return billingMessage(billing, result)
  }, [billing, member, activeDojo?.timezone, daysLeft, isSpecialRole, isLifetime])

  const vencimientoLabel = useMemo(() => {
    if (isSpecialRole || isLifetime) return 'Sin vencimiento'
    if (!member?.next_payment_due) return '—'
    const due = new Date(member.next_payment_due + 'T12:00:00')
    if (due < new Date()) return `Venció el ${fmtDate(member.next_payment_due)}`
    return fmtDate(member.next_payment_due)
  }, [member?.next_payment_due, isSpecialRole, isLifetime])

  const attendanceSuccessCount = attendance.filter(a =>
    a.result?.toLowerCase().includes('autorizado') || a.result?.toLowerCase().includes('success')
  ).length

  /* ---- Render ---- */
  return (
    <AdminLayout active="/profile">
      <div className="relative min-h-screen overflow-x-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-kuro-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-kuro-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <div>

            {/* Loading */}
            {loading ? (
              <div className="min-h-[70vh] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-kuro-500/10 flex items-center justify-center mx-auto mb-6">
                    <UserIcon className="w-12 h-12 text-kuro-600 animate-pulse" />
                  </div>
                  <p className="text-carbon-500 font-bold text-xl uppercase tracking-widest animate-pulse">Cargando Perfil...</p>
                </div>
              </div>

            ) : notLogged || !member ? (
              <div className="min-h-[70vh] flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-12 text-center shadow-2xl backdrop-blur-xl"
                >
                  {/* Hay dos motivos muy distintos para llegar acá y antes los
                      dos mostraban el mismo cartel rojo de "acceso restringido":
                      no tener sesión (un problema) o ser staff de plataforma /
                      marca, que no es alumno de ninguna sede y por lo tanto no
                      tiene ficha que mostrar (lo normal). */}
                  {isPlatformAdmin || orgRole ? (
                    <>
                      <ShieldCheck className="w-16 h-16 text-kuro-500 mx-auto mb-6" />
                      <h2 className="text-2xl font-black text-carbon-900 dark:text-white mb-2 uppercase tracking-tight">
                        No tenés ficha de alumno
                      </h2>
                      <p className="text-carbon-500 dark:text-carbon-400">
                        Tu acceso es {isPlatformAdmin ? 'de plataforma' : 'de marca'}, no de una sede.
                        Esta pantalla muestra la cuota y las clases de un alumno, y vos no estás
                        inscripto en {activeDojo?.name ?? 'ninguna sede'}.
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-16 h-16 text-alert-500 mx-auto mb-6" />
                      <h2 className="text-3xl font-black text-carbon-900 dark:text-white mb-2 uppercase tracking-tight">Acceso Restringido</h2>
                      <p className="text-carbon-500 dark:text-carbon-400 text-lg">No pudimos encontrar tu perfil. Verificá tu sesión o contactá a recepción.</p>
                    </>
                  )}
                </motion.div>
              </div>

            ) : (
              <div className="space-y-6">

                {/* ===== MOBILE HEADER ===== */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="lg:hidden"
                >
                  {/* Avatar + Name */}
                  <div className="flex flex-col items-center text-center pt-2 pb-6">
                    <div className="relative group mb-4">
                      <div className="w-28 h-28 rounded-[28px] overflow-hidden bg-gradient-to-br from-kuro-600 to-kuro-700 flex items-center justify-center shadow-2xl shadow-kuro-500/30">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-14 h-14 text-white" />
                        )}
                        <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity cursor-pointer rounded-[28px]">
                          <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
                          {uploading ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <Camera className="w-7 h-7 text-white" />}
                        </label>
                      </div>
                      {/* Status dot */}
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-carbon-900 ${isActive ? 'bg-kuro-500' : 'bg-alert-500'}`} />
                    </div>

                    <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
                      {fullName || member.first_name || 'Miembro'}
                    </h1>
                    <p className="text-sm text-carbon-400 font-medium mb-3">{member.email}</p>

                    {/* Role + Status badges */}
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-kuro-100 dark:bg-kuro-900/40 text-kuro-600 dark:text-kuro-400 text-xs font-black uppercase tracking-wider">
                        {member.role === 'admin' ? 'Administrador' :
                          member.role === 'instructor' ? 'Instructor' :
                            member.role === 'becado' ? 'Becado' : 'Socio'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${isActive ? 'bg-kuro-100 dark:bg-kuro-900/40 text-kuro-600 dark:text-kuro-400' : 'bg-alert-100 dark:bg-alert-900/40 text-alert-600 dark:text-alert-400'}`}>
                        {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {isActive ? 'Activo' : 'Vencido'}
                      </span>
                    </div>
                  </div>

                  {/* Membresía card mobile */}
                  <div className="rounded-2xl bg-white dark:bg-carbon-800/60 border border-carbon-100 dark:border-carbon-700 shadow-sm p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-carbon-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Próximo Vencimiento
                        </p>
                        <p className={`text-base font-black tracking-tight ${!isActive && !isSpecialRole && !isLifetime ? 'text-alert-500' : 'text-carbon-900 dark:text-white'}`}>
                          {vencimientoLabel}
                        </p>
                        {daysLeft !== null && daysLeft > 0 && !isSpecialRole && !isLifetime && (
                          <p className={`text-xs font-bold mt-0.5 ${daysLeft < 7 ? 'text-alert-400' : 'text-carbon-400'}`}>
                            Quedan {daysLeft} días
                          </p>
                        )}
                      </div>
                      {daysLeft !== null && !isSpecialRole && !isLifetime && (
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${daysLeft < 7 ? 'bg-alert-50 dark:bg-alert-900/20' : 'bg-kuro-50 dark:bg-kuro-900/20'}`}>
                          <p className={`text-2xl font-black tabular-nums ${daysLeft < 7 ? 'text-alert-500' : 'text-kuro-600 dark:text-kuro-400'}`}>
                            {daysLeft > 0 ? daysLeft : 0}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {daysLeft !== null && !isSpecialRole && !isLifetime && (
                      <div className="mt-3 h-1.5 w-full bg-carbon-100 dark:bg-carbon-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: daysLeft > 0 ? `${Math.min(100, (daysLeft / 30) * 100)}%` : '100%' }}
                          className={`h-full rounded-full ${daysLeft < 7 ? 'bg-alert-500' : 'bg-kuro-600'}`}
                        />
                      </div>
                    )}
                  </div>

                  {mercadoPago && !isSpecialRole && !isLifetime && (
                    <button onClick={() => setShowPayModal(true)} className="w-full h-14 rounded-2xl bg-[#009EE3] mb-4 relative overflow-hidden">
                      <img src="/mp_button.png" alt="Pagar con Mercado Pago" className="absolute inset-0 w-full h-full object-contain" />
                    </button>
                  )}

                  {/* Section buttons mobile */}
                  <div className="space-y-3">
                    <SectionButton
                      icon={<GraduationCap className="w-5 h-5" />}
                      label="Mis Clases"
                      sublabel={classes.length > 0 ? `${classes.length} clase${classes.length > 1 ? 's' : ''} inscripta${classes.length > 1 ? 's' : ''}` : 'Sin clases asignadas'}
                      onClick={() => setSheetClases(true)}
                      accent="blue"
                    />
                    <SectionButton
                      icon={<Activity className="w-5 h-5" />}
                      label="Mi Asistencia"
                      sublabel={attendance.length > 0 ? `${attendanceSuccessCount} ingresos registrados` : 'Sin registros aún'}
                      onClick={() => setSheetAsistencia(true)}
                      accent="emerald"
                    />
                    {can('graduations') && (
                      <SectionButton
                        icon={<Shield className="w-5 h-5" />}
                        label="Mis Graduaciones"
                        sublabel="Cinturones y logros"
                        onClick={() => setSheetGraduaciones(true)}
                        accent="purple"
                      />
                    )}
                  </div>

                  {/* Contact info mobile */}
                  <div className="mt-4 p-4 rounded-2xl bg-white dark:bg-carbon-800/60 border border-carbon-100 dark:border-carbon-700 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black text-carbon-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-warn-500" />
                        Contacto
                      </h3>
                      {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="p-1.5 rounded-lg bg-carbon-100 dark:bg-carbon-700 hover:bg-kuro-600 hover:text-white transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => { setIsEditing(false); setEditForm({ phone: member.phone ?? '', emergency: emergency ?? '' }) }} className="p-1.5 rounded-lg bg-carbon-100 dark:bg-carbon-700 hover:bg-alert-500 hover:text-white transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button disabled={isSaving} onClick={handleSaveInfo} className="p-1.5 rounded-lg bg-kuro-600 text-white hover:bg-kuro-700 transition-all disabled:opacity-50">
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-black text-carbon-400 uppercase tracking-widest mb-1">Teléfono</p>
                        {isEditing ? (
                          <input type="text" className="w-full bg-carbon-50 dark:bg-carbon-900 border border-carbon-200 dark:border-carbon-700 rounded-xl px-3 py-2 text-sm font-bold text-carbon-900 dark:text-white focus:ring-2 ring-kuro-500/20 outline-none" value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="+54 9 11 ..." />
                        ) : (
                          <p className="font-bold text-carbon-900 dark:text-white text-sm">{member.phone || 'No registrado'}</p>
                        )}
                      </div>
                      <div className="pt-3 border-t border-carbon-100 dark:border-carbon-700">
                        <p className="text-[10px] font-black text-carbon-400 uppercase tracking-widest mb-1">Emergencias</p>
                        {isEditing ? (
                          <input type="text" className="w-full bg-carbon-50 dark:bg-carbon-900 border border-carbon-200 dark:border-carbon-700 rounded-xl px-3 py-2 text-sm font-black text-alert-600 dark:text-alert-400 uppercase focus:ring-2 ring-kuro-500/20 outline-none" value={editForm.emergency} onChange={(e) => setEditForm(prev => ({ ...prev, emergency: e.target.value }))} placeholder="Nombre y/o Teléfono" />
                        ) : (
                          <p className="font-black text-alert-600 dark:text-alert-400 uppercase tracking-tight text-sm">{emergency || 'Sin contacto definido'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* ===== DESKTOP LAYOUT (lg+) — igual que antes ===== */}
                <div className="hidden lg:block space-y-8">
                  {/* Header */}
                  <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-6">
                      <div className="relative group shrink-0">
                        <div className="w-28 h-28 rounded-3xl overflow-hidden bg-gradient-to-br from-kuro-600 to-kuro-700 flex items-center justify-center shadow-2xl shadow-kuro-500/40 transform group-hover:rotate-2 transition-transform">
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
                      </div>
                      <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
                          Hola, <span className="text-kuro-600 dark:text-kuro-400">{member.first_name || 'Miembro'}</span>
                        </h1>
                        <p className="text-carbon-500 dark:text-carbon-400 text-lg font-medium flex items-center gap-2">
                          <span>{member.email}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-kuro-100 dark:bg-kuro-900/40 text-kuro-600 dark:text-kuro-400 text-xs font-black uppercase tracking-wider">
                            {member.role === 'admin' ? 'Administrador' : member.role === 'instructor' ? 'Instructor' : member.role === 'becado' ? 'Becado' : 'Socio Activo'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
                    {/* Left column */}
                    <div className="lg:col-span-2 space-y-8">
                      {/* Status cards */}
                      <div className="grid md:grid-cols-2 gap-6">
                        <motion.div whileHover={{ y: -4 }} className="p-6 rounded-3xl border border-white/10 bg-white dark:bg-carbon-800/50 dark:backdrop-blur-xl dark:border-carbon-700 shadow-xl">
                          <p className="text-[10px] font-black text-carbon-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> ESTADO DE MEMBRESÍA
                          </p>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-4 ${isActive ? 'bg-kuro-100 text-kuro-700 dark:bg-kuro-900/30 dark:text-kuro-400' : 'bg-alert-100 text-alert-700 dark:bg-alert-900/30 dark:text-alert-400'}`}>
                            {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {isActive ? 'Activo' : 'Vencido'}
                          </div>
                          <p className="text-3xl font-black text-carbon-900 dark:text-white tracking-tighter">
                            {isActive ? (member?.next_payment_due && new Date(member.next_payment_due + 'T12:00:00') < new Date() ? 'Pago pendiente' : 'Membresía al día') : 'Pago pendiente'}
                          </p>
                        </motion.div>

                        <motion.div whileHover={{ y: -4 }} className="p-6 rounded-3xl border border-white/10 bg-white dark:bg-carbon-800/50 dark:backdrop-blur-xl dark:border-carbon-700 shadow-xl">
                          <p className="text-[10px] font-black text-carbon-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Clock className="w-3 h-3" /> PRÓXIMO VENCIMIENTO
                          </p>
                          <p className="text-3xl font-black text-carbon-900 dark:text-white tracking-tighter mb-4">{vencimientoLabel}</p>
                          {daysLeft !== null && !isSpecialRole && !isLifetime && (
                            <div className="h-2 w-full bg-carbon-100 dark:bg-carbon-700 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: daysLeft > 0 ? `${Math.min(100, (daysLeft / 30) * 100)}%` : '100%' }}
                                className={`h-full rounded-full ${daysLeft < 7 ? 'bg-alert-500' : 'bg-kuro-600'}`}
                              />
                            </div>
                          )}
                          <p className="text-xs font-bold text-carbon-400 mt-2">
                            {paymentStatusMessage}
                          </p>
                          {mercadoPago && !isSpecialRole && !isLifetime && (
                            <div className="mt-4">
                              <button onClick={() => setShowPayModal(true)} className="w-full h-14 relative transition-all hover:scale-105 active:scale-95 rounded-2xl overflow-hidden shadow-lg bg-[#009EE3]">
                                <img src="/mp_button.png" alt="Pagar Suscripción" className="absolute inset-0 w-full h-full object-contain" />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      </div>

                      {/* Classes */}
                      <div className="space-y-6">
                        <h2 className="text-xl font-black text-carbon-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                          <GraduationCap className="w-5 h-5 text-kuro-600" /> Mis Clases Inscritas
                        </h2>
                        {classes.length === 0 ? (
                          <div className="p-12 text-center rounded-3xl border-2 border-dashed border-carbon-200 dark:border-carbon-700">
                            <p className="text-carbon-400 font-bold italic uppercase tracking-widest">No estás en clases todavía</p>
                          </div>
                        ) : (
                          <div className="space-y-8">
                            {classes.some(c => c.is_principal) && (
                              <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-kuro-500 ml-1 flex items-center gap-2">
                                  <Shield className="w-3 h-3" /> Clase Principal
                                </p>
                                <div className="grid gap-4">
                                  {classes.filter(c => c.is_principal).map((c, idx) => <ClassItem key={c.id} c={c} idx={idx} />)}
                                </div>
                              </div>
                            )}
                            {classes.some(c => !c.is_principal) && (
                              <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-kuro-500 ml-1 flex items-center gap-2">
                                  <Plus className="w-3 h-3" /> Clases Adicionales
                                </p>
                                <div className="grid md:grid-cols-2 gap-4">
                                  {classes.filter(c => !c.is_principal).map((c, idx) => <ClassItem key={c.id} c={c} idx={idx} />)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Grades */}
                      {can('graduations') && (
                        <div className="pt-8 border-t border-carbon-100 dark:border-carbon-800">
                          <MemberGrades userId={member.user_id} readOnly={true} />
                        </div>
                      )}
                    </div>

                    {/* Right column */}
                    <div className="space-y-8">
                      {/* Attendance */}
                      <div className="space-y-6">
                        <h2 className="text-xl font-black text-carbon-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                          <Activity className="w-5 h-5 text-kuro-600" /> Mi Asistencia
                        </h2>
                        <div className="p-1 rounded-3xl bg-carbon-50 dark:bg-carbon-900/50 border border-carbon-100 dark:border-carbon-700">
                          <div className="max-h-[600px] overflow-y-auto pr-1">
                            {attendance.length === 0 ? (
                              <div className="p-8 text-center text-carbon-400 text-xs font-bold uppercase tracking-widest italic">Sin registros aún</div>
                            ) : (
                              <div className="space-y-2 p-2">
                                {attendance.map((att, i) => {
                                  const ok = att.result?.toLowerCase().includes('autorizado') || att.result?.toLowerCase().includes('success')
                                  return (
                                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-2xl bg-white dark:bg-carbon-800/80 border border-carbon-100 dark:border-carbon-700 shadow-sm flex items-center gap-4">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ok ? 'bg-kuro-100 text-kuro-600 dark:bg-kuro-900/30 dark:text-kuro-400' : 'bg-alert-100 text-alert-600 dark:bg-alert-900/30 dark:text-alert-400'}`}>
                                        {ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                          <p className="text-xs font-black text-carbon-900 dark:text-white">{new Date(att.scanned_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</p>
                                          <p className="text-[10px] font-bold text-carbon-400">{new Date(att.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <p className="text-[10px] font-bold text-carbon-400 uppercase tracking-widest mt-0.5">
                                          {ok ? (att.classes && att.classes.length > 0 ? `Acceso a: ${att.classes.map(c => c.name).join(', ')}` : 'Acceso correcto') : 'DENEGADO'}
                                        </p>
                                      </div>
                                    </motion.div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="p-8 rounded-3xl border border-white/10 bg-white dark:bg-carbon-800/50 dark:backdrop-blur-xl dark:border-carbon-700 shadow-xl space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-black text-carbon-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-warn-500" /> Info de Contacto
                          </h3>
                          {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="p-2 rounded-xl bg-carbon-100 dark:bg-carbon-700 hover:bg-kuro-600 hover:text-white transition-all">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => { setIsEditing(false); setEditForm({ phone: member.phone ?? '', emergency: emergency ?? '' }) }} className="p-2 rounded-xl bg-carbon-100 dark:bg-carbon-700 hover:bg-alert-500 hover:text-white transition-all">
                                <X className="w-4 h-4" />
                              </button>
                              <button disabled={isSaving} onClick={handleSaveInfo} className="p-2 rounded-xl bg-kuro-600 text-white hover:bg-kuro-700 transition-all disabled:opacity-50">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-black text-carbon-400 uppercase tracking-widest mb-1">Teléfono</p>
                            {isEditing ? (
                              <input type="text" className="w-full bg-carbon-50 dark:bg-carbon-900 border border-carbon-200 dark:border-carbon-700 rounded-xl px-4 py-2 text-sm font-bold text-carbon-900 dark:text-white focus:ring-2 ring-kuro-500/20 outline-none" value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="+54 9 11 ..." />
                            ) : (
                              <p className="font-bold text-carbon-900 dark:text-white">{member.phone || 'No registrado'}</p>
                            )}
                          </div>
                          <div className="pt-6 border-t border-carbon-100 dark:border-carbon-700">
                            <p className="text-[10px] font-black text-carbon-400 uppercase tracking-widest mb-1">Emergencias</p>
                            {isEditing ? (
                              <input type="text" className="w-full bg-carbon-50 dark:bg-carbon-900 border border-carbon-200 dark:border-carbon-700 rounded-xl px-4 py-2 text-sm font-black text-alert-600 dark:text-alert-400 uppercase focus:ring-2 ring-kuro-500/20 outline-none" value={editForm.emergency} onChange={(e) => setEditForm(prev => ({ ...prev, emergency: e.target.value }))} placeholder="Nombre y/o Teléfono" />
                            ) : (
                              <p className="font-black text-alert-600 dark:text-alert-400 uppercase tracking-tight">{emergency || 'Sin contacto definido'}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== BOTTOM SHEETS (mobile only) ===== */}

      {/* Clases */}
      <BottomSheet open={sheetClases} onClose={() => setSheetClases(false)} title="Mis Clases">
        {classes.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-carbon-400 font-bold italic uppercase tracking-widest text-sm">No estás en clases todavía</p>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {classes.some(c => c.is_principal) && (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-kuro-500 flex items-center gap-2">
                  <Shield className="w-3 h-3" /> Clase Principal
                </p>
                {classes.filter(c => c.is_principal).map((c, idx) => <ClassItem key={c.id} c={c} idx={idx} />)}
              </div>
            )}
            {classes.some(c => !c.is_principal) && (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-kuro-500 flex items-center gap-2">
                  <Plus className="w-3 h-3" /> Clases Adicionales
                </p>
                {classes.filter(c => !c.is_principal).map((c, idx) => <ClassItem key={c.id} c={c} idx={idx} />)}
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Asistencia */}
      <BottomSheet open={sheetAsistencia} onClose={() => setSheetAsistencia(false)} title="Mi Asistencia">
        {attendance.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-carbon-400 font-bold italic uppercase tracking-widest text-sm">Sin registros aún</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {attendance.map((att, i) => {
              const ok = att.result?.toLowerCase().includes('autorizado') || att.result?.toLowerCase().includes('success')
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="p-4 rounded-2xl bg-carbon-50 dark:bg-carbon-800/60 border border-carbon-100 dark:border-carbon-700 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-kuro-100 text-kuro-600 dark:bg-kuro-900/30 dark:text-kuro-400' : 'bg-alert-100 text-alert-600 dark:bg-alert-900/30 dark:text-alert-400'}`}>
                    {ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-carbon-900 dark:text-white">{new Date(att.scanned_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-xs font-bold text-carbon-400">{new Date(att.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <p className="text-[10px] font-bold text-carbon-400 uppercase tracking-widest mt-0.5 truncate">
                      {ok ? (att.classes && att.classes.length > 0 ? att.classes.map(c => c.name).join(', ') : 'Acceso correcto') : 'Denegado'}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </BottomSheet>

      {/* Graduaciones */}
      <BottomSheet open={sheetGraduaciones} onClose={() => setSheetGraduaciones(false)} title="Mis Graduaciones">
        <div className="pb-4">
          {member && <MemberGrades userId={member.user_id} readOnly={true} />}
        </div>
      </BottomSheet>

      {/* Pay Modal */}
      <SubscriptionModal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        initialData={{
          principal: classes.find(c => c.is_principal)?.id,
          additional: classes.filter(c => !c.is_principal).map(c => c.id)
        }}
      />

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md bg-carbon-900 border-white/10 text-white rounded-3xl p-0 overflow-hidden">
          <div className="p-8 text-center bg-gradient-to-b from-transparent to-black/40">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-kuro-500/20 flex items-center justify-center border border-kuro-500/30 relative">
                <div className="absolute inset-0 bg-kuro-500 blur-2xl opacity-20 animate-pulse" />
                <CheckCircle2 className="w-14 h-14 text-kuro-500 relative z-10" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase italic leading-none">¡Foto Actualizada!</h2>
              <div className="pt-6">
                <Button onClick={() => setShowSuccessModal(false)} className="w-full py-6 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-widest">
                  Continuar
                </Button>
              </div>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cropper Modal */}
      <AnimatePresence>
        {tempImage && (
          <PhotoCropper
            image={tempImage}
            onCancel={() => setTempImage(null)}
            onCropComplete={handleApplyCrop}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}