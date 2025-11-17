'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../layouts/AdminLayout'
import {
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  GraduationCap,
  AlertCircle,
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(`${d}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function daysDiff(a: Date, b: Date) { a.setHours(0,0,0,0); b.setHours(0,0,0,0); return Math.round((b.getTime()-a.getTime())/86400000) }
function money(v: number | string | null) { const n = typeof v === 'string' ? Number(v) : v ?? 0; return n.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}) }
function scheduleStr(days: string[] | null, start?: string | null, end?: string | null) {
  const dias = (days ?? []).map(d => en2es[d.toLowerCase().slice(0,3)] ?? d)
  const base = dias.length ? dias.join(', ') : '—'
  const t = (v?: string | null) => v ? new Date(`1970-01-01T${v}`).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}) : ''
  return (start || end) ? `${base} – ${t(start)}${end ? ` a ${t(end)}` : ''}` : base
}
const statusPill = (ok: boolean) => ok ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
const colorBadge: Record<string,string> = {
  blue:'bg-blue-100 text-blue-800 border-blue-200', red:'bg-red-100 text-red-800 border-red-200',
  green:'bg-green-100 text-green-800 border-green-200', purple:'bg-purple-100 text-purple-800 border-purple-200',
  orange:'bg-orange-100 text-orange-800 border-orange-200', pink:'bg-pink-100 text-pink-800 border-pink-200',
}

export default function ProfilePage() {
  const [member, setMember] = useState<MemberRow | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [emergency, setEmergency] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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

      setMember(vw as MemberRow)

      const { data: prof } = await supabase
        .from('profiles').select('emergency_phone').eq('user_id', vw.user_id).maybeSingle()
      setEmergency(prof?.emergency_phone ?? null)

      const { data: enr } = await supabase
        .from('class_enrollments')
        .select('class_id, classes:class_id (id,name,instructor,color,price,days,start_time,end_time)')
        .eq('user_id', vw.user_id)
      setClasses(((enr ?? []) as any[]).map(r => r.classes).filter(Boolean))

      setLoading(false)
    })()
  }, [])

  const fullName = useMemo(() => [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim(), [member])
  const isActive = useMemo(() => member?.next_payment_due ? new Date(`${member.next_payment_due}T00:00:00`) >= new Date(new Date().toDateString()) : false, [member])
  const daysLeft = useMemo(() => member?.next_payment_due ? daysDiff(new Date(), new Date(`${member.next_payment_due}T00:00:00`)) : null, [member])

  // ---- Render dentro de AdminLayout para tener side menu ----
  return (
    <AdminLayout>
      {loading ? (
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
              <UserIcon className="w-10 h-10 text-blue-600 animate-pulse" />
            </div>
            <p className="text-slate-600">Cargando perfil…</p>
          </div>
        </div>
      ) : notLogged ? (
        <div className="min-h-[70vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border bg-white p-8 text-center shadow">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-900 mb-1">No iniciado sesión</h2>
            <p className="text-slate-600">Ingresá a tu cuenta para ver tu perfil.</p>
          </div>
        </div>
      ) : !member ? (
        <div className="min-h-[70vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border bg-white p-8 text-center shadow">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-900 mb-1">No encontrado</h2>
            <p className="text-slate-600">No pudimos encontrar tu perfil. Contactá recepción.</p>
          </div>
        </div>
      ) : (
        <div className="p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <UserIcon className="w-10 h-10 text-blue-600" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">Mi Perfil</h1>
              <p className="text-slate-600">Información de tu membresía</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="rounded-xl border bg-white shadow">
                <div className="border-b px-6 py-4">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                    Información Personal
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Nombre Completo</p>
                    <p className="text-lg font-semibold text-slate-900">{fullName || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span>{member.email || '—'}</span>
                  </div>
                  {member.phone && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Código de Acceso</p>
                    <p className="text-lg font-mono font-semibold text-blue-600">{member.access_code || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white shadow">
                <div className="border-b px-6 py-4">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    Estado de Membresía
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Estado Actual</p>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${statusPill(isActive)}`}>
                      {isActive ? 'activo' : 'vencido'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Tipo de Membresía</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {member.membership_type === 'monthly' ? 'Mensual'
                        : member.membership_type === 'quarterly' ? 'Trimestral'
                        : member.membership_type === 'semiannual' ? 'Semestral'
                        : member.membership_type === 'annual' ? 'Anual' : '—'}
                    </p>
                  </div>
                  {member.next_payment_due && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Próximo Vencimiento</p>
                      <p className="text-lg font-semibold text-slate-900">{fmtDate(member.next_payment_due)}</p>
                      {daysLeft !== null && (
                        <p className={`text-sm mt-1 ${daysLeft < 7 ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                          {daysLeft > 0
                            ? `Faltan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`
                            : daysLeft === 0
                            ? '¡Vence hoy!'
                            : `Vencido hace ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'día' : 'días'}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white shadow">
              <div className="border-b px-6 py-4">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <GraduationCap className="w-5 h-5 text-blue-600" />
                  Mis Clases
                </div>
              </div>
              <div className="p-6">
                {classes.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No estás inscrito en ninguna clase</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {classes.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border bg-slate-50 p-4 border-l-4"
                        style={{
                          borderLeftColor:
                            c.color === 'blue' ? '#3b82f6' :
                            c.color === 'red' ? '#ef4444' :
                            c.color === 'green' ? '#10b981' :
                            c.color === 'purple' ? '#a855f7' :
                            c.color === 'orange' ? '#f97316' :
                            '#ec4899',
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-slate-900">{c.name}</h3>
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${colorBadge[c.color ?? 'blue'] ?? colorBadge.blue}`}>
                            {money(c.price)}/mes
                          </span>
                        </div>
                        {c.instructor && (
                          <p className="text-sm text-slate-600 mb-1">Instructor: {c.instructor}</p>
                        )}
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Calendar className="w-3 h-3" />
                          <span>{scheduleStr(c.days, c.start_time, c.end_time)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {emergency && (
              <div className="rounded-xl border bg-white shadow mt-6">
                <div className="p-6">
                  <p className="text-sm text-slate-500 mb-1">Contacto de Emergencia</p>
                  <p className="text-slate-900">{emergency}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
