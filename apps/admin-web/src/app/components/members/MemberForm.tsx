'use client'

import { useEffect, useMemo, useState } from 'react'
import { lastDayOfMonth } from 'date-fns'
import { motion } from 'framer-motion'
import { User, Mail, Phone, Hash, Shield, Calendar, BookOpen, AlertCircle, Save, Plus, Award, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'
import { MemberRow, MemberPayload, ClassOption } from '@/types/member'

export default function MemberForm({
  member,
  onSubmit,
  onCancel,
}: {
  member: MemberRow | null
  onSubmit: (payload: MemberPayload) => Promise<void>
  onCancel: () => void
}) {
  // Las clases y la membresía que edita este formulario son de la sede activa.
  const { activeDojo } = useTenant()
  const dojoId = activeDojo?.id

  const [classes, setClasses] = useState<ClassOption[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    access_code: '',
    principal_class: null as number | null,
    additional_classes: [] as number[],
    last_payment_date: new Date().toISOString().slice(0, 10),
    start_date: '', // Join Date
    next_payment_due: lastDayOfMonth(new Date()).toISOString().slice(0, 10),
    emergency_contact: '',
    notes: '',
    role: 'member' as 'admin' | 'member' | 'instructor' | 'becado',
  })
  const [manualCode, setManualCode] = useState(false)

  useEffect(() => {
    if (!dojoId) return
    supabase
      .from('classes')
      .select('id,name,price_principal,price_additional,color')
      .eq('dojo_id', dojoId)
      .then(({ data }) => setClasses((data as unknown as ClassOption[]) ?? []))
  }, [dojoId])

  useEffect(() => {
    if (member) {
      setForm((prev) => ({
        ...prev,
        full_name: [member.first_name, member.last_name].filter(Boolean).join(' '),
        email: member.email ?? '',
        phone: member.phone ?? '',
        access_code: member.access_code ?? '',
        // These will be corrected in the class_enrollments fetch below
        principal_class: member.class_ids?.[0] ?? null,
        additional_classes: member.class_ids?.slice(1) ?? [],
        next_payment_due: (member.next_payment_due || member.end_date) ? new Date((member.next_payment_due || member.end_date) + 'T12:00:00').toISOString().slice(0, 10) : lastDayOfMonth(new Date()).toISOString().slice(0, 10),
        emergency_contact: member.emergency_phone ?? '',
        notes: member.notes ?? '',
        role: member.role ?? 'member',
      }))

      // 1. Fetch exact enrollment status (principal vs additional)
      supabase.from('class_enrollments')
        .select('class_id, is_principal')
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .eq('user_id', member.user_id)
        .then(({ data: enrollments }) => {
          if (enrollments && enrollments.length > 0) {
            const principal = enrollments.find(e => e.is_principal)?.class_id || enrollments[0].class_id
            const additionals = enrollments.filter(e => e.class_id !== principal).map(e => e.class_id)
            setForm(prev => ({
              ...prev,
              principal_class: principal,
              additional_classes: additionals
            }))
          }
        })

      // 2. Fetch exact membership dates
      supabase.from('memberships')
        .select('start_date, last_payment_date')
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .eq('member_id', member.user_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setForm(prev => ({
              ...prev,
              start_date: data.start_date || '',
              last_payment_date: data.last_payment_date || new Date().toISOString().slice(0, 10)
            }))
          }
        })
    }
  }, [member, dojoId])

  // Autocomplete Access Code
  useEffect(() => {
    if (manualCode) return
    const isPlaceholder = !form.access_code || form.access_code.toUpperCase() === 'X'
    if (member && !isPlaceholder) return

    const parts = form.full_name.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (parts.length < 2) {
      if (form.full_name === '') setForm(f => ({ ...f, access_code: '' }))
      return
    }

    let active = true
    const timeout = setTimeout(async () => {
      const initial = parts[0][0]
      const lastname = parts.slice(1).join('')
      const suggested = (initial + lastname).replace(/[^a-z0-9]/g, '')

      let unique = suggested
      let counter = 2
      let isUnique = false

      while (!isUnique && active) {
        const { data } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('access_code', unique)
          .maybeSingle()

        if (!data || (member && data.user_id === member.user_id)) {
          isUnique = true
        } else {
          unique = suggested + counter
          counter++
        }
      }

      if (active) {
        setForm(f => ({ ...f, access_code: unique }))
      }
    }, 600) // Debounce 600ms

    return () => {
      active = false
      clearTimeout(timeout)
    }
    // form.access_code y member (más allá de user_id) se leen a propósito sin ser
    // dependencias: este mismo efecto es quien escribe form.access_code, así que
    // incluirlo reengancharía el efecto en loop contra su propio setForm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.full_name, manualCode, member?.user_id])



  const setPrincipalClass = (id: number) => {
    setForm(s => ({
      ...s,
      principal_class: id,
      // Ensure it's not in additional
      additional_classes: s.additional_classes.filter(x => x !== id)
    }))
  }

  const toggleAdditionalClass = (id: number) => {
    if (id === form.principal_class) return
    setForm(s => ({
      ...s,
      additional_classes: s.additional_classes.includes(id)
        ? s.additional_classes.filter(x => x !== id)
        : [...s.additional_classes, id]
    }))
  }

  const totalFee = useMemo(() => {
    let total = 0
    if (form.principal_class) {
      const p = classes.find(c => c.id === form.principal_class)
      total += Number(p?.price_principal || 0)
    }
    form.additional_classes.forEach(id => {
      const a = classes.find(c => c.id === id)
      total += Number(a?.price_additional || a?.price_principal || 0)
    })
    return total
  }, [form.principal_class, form.additional_classes, classes])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.principal_class) return toast.error('Debes seleccionar una clase principal')
    setIsSubmitting(true)
    try {
      // Map to the new format expected by members/page.tsx
      const payload = {
        ...form,
        classes: [
          { class_id: form.principal_class, is_principal: true },
          ...form.additional_classes.map(id => ({ class_id: id, is_principal: false }))
        ]
      }
      await onSubmit(payload)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = "w-full h-12 bg-carbon-50 dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 rounded-xl px-4 pl-11 text-carbon-900 dark:text-white font-medium placeholder:text-carbon-400 dark:placeholder:text-carbon-500 focus:outline-none focus:ring-4 focus:ring-kuro-500/10 focus:border-kuro-500/50 transition-all font-sans"

  return (
    <form onSubmit={submit} className="space-y-10">
      {/* --- Personal Section --- */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-kuro-50 dark:bg-kuro-900/30 flex items-center justify-center text-kuro-600 dark:text-kuro-400">
            <User className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-black text-carbon-900 dark:text-white uppercase tracking-widest">Información Personal</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon-400 group-focus-within:text-kuro-500 transition-colors" />
            <input
              className={inputClass}
              placeholder="Nombre completo *"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>

          <div className="relative group">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon-400 group-focus-within:text-kuro-500 transition-colors" />
            <input
              className={inputClass}
              placeholder="Código de acceso personalizado"
              value={form.access_code}
              onChange={(e) => {
                setForm({ ...form, access_code: e.target.value })
                setManualCode(true)
              }}
            />
          </div>

          <div className="relative group md:col-span-2">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon-400 group-focus-within:text-kuro-500 transition-colors" />
            <input
              className={inputClass}
              type="email"
              placeholder="Correo electrónico *"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="relative group">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon-400 group-focus-within:text-kuro-500 transition-colors" />
            <input
              className={inputClass}
              placeholder="Teléfono móvil"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="relative group">
            <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon-400 group-focus-within:text-kuro-500 transition-colors" />
            <input
              className={inputClass}
              placeholder="Contacto de emergencia"
              value={form.emergency_contact}
              onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
            />
          </div>

          <div className="relative group md:col-span-2">
            <div className="absolute -top-6 left-0 text-[10px] font-black text-carbon-400 uppercase tracking-widest">Rol de Usuario</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'member', label: 'Socio', icon: User },
                { id: 'instructor', label: 'Instructor', icon: Shield },
                { id: 'becado', label: 'Becado', icon: Award },
                { id: 'admin', label: 'Admin', icon: UserPlus }
              ].map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm({ ...form, role: r.id as 'admin' | 'member' | 'instructor' | 'becado' })}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${form.role === r.id
                    ? 'bg-kuro-600 border-kuro-600 text-white shadow-lg shadow-kuro-500/20'
                    : 'bg-white dark:bg-carbon-800 border-carbon-100 dark:border-carbon-700 text-carbon-600 dark:text-carbon-300 hover:border-carbon-300 dark:hover:border-carbon-500'
                    }`}
                >
                  <r.icon className={`w-4 h-4 ${form.role === r.id ? 'text-white' : 'text-kuro-500'}`} />
                  <span className="text-xs font-black uppercase tracking-widest">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- Membership Section --- */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-kuro-50 dark:bg-kuro-900/30 flex items-center justify-center text-kuro-600 dark:text-kuro-400">
            <Shield className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-black text-carbon-900 dark:text-white uppercase tracking-widest">Membresía y Pagos</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="relative group col-span-1 md:col-span-1">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon-400 group-focus-within:text-kuro-500 transition-colors" />
            <input
              className={`${inputClass} focus:ring-kuro-500/10 focus:border-kuro-500/50`}
              type="date"
              lang="es"
              value={form.last_payment_date}
              onChange={(e) => {
                const val = e.target.value
                const baseDate = new Date(val + 'T12:00:00')
                const expiration = lastDayOfMonth(baseDate).toISOString().slice(0, 10)
                setForm(prev => ({
                  ...prev,
                  last_payment_date: val,
                  next_payment_due: expiration
                }))
              }}
            />
            <div className="absolute -top-6 left-0 text-[10px] font-black text-carbon-400 uppercase tracking-widest">Último Pago / Renovación</div>
          </div>

          <div className="relative group col-span-1 md:col-span-1">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon-400 group-focus-within:text-kuro-500 transition-colors" />
            <input
              className={`${inputClass} bg-carbon-100 dark:bg-carbon-900 text-carbon-500 dark:text-carbon-400 cursor-not-allowed`}
              type="date"
              lang="es"
              value={form.start_date}
              readOnly
            />
            <div className="absolute -top-6 left-0 text-[10px] font-black text-carbon-400 uppercase tracking-widest">Fecha de Alta (Antigüedad)</div>
          </div>

          <div className="relative group col-span-1 md:col-span-1 opacity-60">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-carbon-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div className={`${inputClass} flex items-center bg-carbon-100 dark:bg-carbon-900 cursor-not-allowed`}>
              {form.next_payment_due === '2099-12-31'
                ? 'VITALICIA'
                : form.next_payment_due
                  ? new Date(form.next_payment_due + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : '—'}
            </div>
            <div className="absolute -top-6 left-0 text-[10px] font-black text-carbon-400 uppercase tracking-widest">Vence Automáticamente</div>
          </div>
        </div>
      </section>

      {/* --- Classes Section --- */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-kuro-50 dark:bg-kuro-900/30 flex items-center justify-center text-kuro-600 dark:text-kuro-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-black text-carbon-900 dark:text-white uppercase tracking-widest">Inscripción a Clases</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Clase Principal */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3 h-3 text-kuro-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-carbon-400">Clase Principal (Obligatoria)</p>
            </div>
            <div className="space-y-2">
              {classes.map(c => (
                <label
                  key={`p-${c.id}`}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${form.principal_class === c.id
                    ? 'bg-kuro-600 border-kuro-600 shadow-xl shadow-kuro-500/20'
                    : 'bg-white dark:bg-carbon-800 border-carbon-100 dark:border-carbon-700 hover:border-carbon-300 dark:hover:border-carbon-500'
                    }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${form.principal_class === c.id ? 'bg-white border-white text-kuro-600' : 'bg-white dark:bg-carbon-900 border-carbon-300 dark:border-carbon-600'
                    }`}>
                    {form.principal_class === c.id && <div className="w-2.5 h-2.5 rounded-full bg-kuro-600" />}
                  </div>
                  <input
                    type="radio"
                    name="principal_class"
                    className="hidden"
                    checked={form.principal_class === c.id}
                    onChange={() => setPrincipalClass(c.id)}
                  />
                  <div className="flex-1">
                    <p className={`text-sm font-bold leading-none ${form.principal_class === c.id ? 'text-white' : 'text-carbon-900 dark:text-white'}`}>{c.name}</p>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${form.principal_class === c.id ? 'text-kuro-100' : 'text-carbon-500 dark:text-carbon-400'}`}>
                      ${Number(c.price_principal).toLocaleString()}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Clases Adicionales */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="w-3 h-3 text-kuro-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-carbon-400">Clases Adicionales (Opcional)</p>
            </div>
            <div className="space-y-2">
              {classes.map(c => {
                const isSelected = form.additional_classes.includes(c.id)
                const isPrincipal = form.principal_class === c.id
                return (
                  <label
                    key={`a-${c.id}`}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isSelected
                      ? 'bg-kuro-50 dark:bg-kuro-500/10 border-kuro-200 dark:border-kuro-500/40'
                      : isPrincipal ? 'opacity-40 cursor-not-allowed bg-carbon-50 dark:bg-carbon-800/50' : 'bg-white dark:bg-carbon-800 border-carbon-100 dark:border-carbon-700 hover:border-carbon-300 dark:hover:border-carbon-500'
                      }`}
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-kuro-500 border-kuro-500 text-white' : 'bg-white dark:bg-carbon-900 border-carbon-300 dark:border-carbon-600'
                      }`}>
                      {isSelected && <CheckIcon className="w-3 h-3" strokeWidth={4} />}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isSelected}
                      disabled={isPrincipal}
                      onChange={() => toggleAdditionalClass(c.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-carbon-900 dark:text-white leading-none">{c.name}</p>
                      <p className="text-[10px] text-carbon-500 dark:text-carbon-400 font-black uppercase tracking-widest mt-1">
                        + ${Number(c.price_additional || c.price_principal).toLocaleString()}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        {/* Total Fee Indicator */}
        <div className="mt-8 p-6 rounded-3xl bg-carbon-950 text-white flex items-center justify-between shadow-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-kuro-500/10 rounded-full blur-3xl group-hover:bg-kuro-500/20 transition-all" />
          <div className="relative">
            <p className="text-[10px] font-black uppercase tracking-widest text-carbon-400 mb-1">Total Cuota Mensual Estimada</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">${totalFee.toLocaleString()}</span>
              <span className="text-xs font-bold text-carbon-500 uppercase tracking-widest">ARS / Mes</span>
            </div>
          </div>
          <div className="relative flex flex-col items-end">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-kuro-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-kuro-500">Cálculo Automático</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- Notes --- */}
      <section>
        <textarea
          className="w-full bg-carbon-50 dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 rounded-2xl px-5 py-4 text-carbon-900 dark:text-white font-medium placeholder:text-carbon-400 dark:placeholder:text-carbon-500 focus:outline-none focus:ring-4 focus:ring-kuro-500/10 focus:border-kuro-500/50 transition-all min-h-[120px]"
          placeholder="Observaciones o notas adicionales..."
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </section>

      {/* --- Footer Actions --- */}
      <div className="flex flex-col sm:flex-row gap-3 pt-6">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          disabled={isSubmitting}
          className="flex-1 h-14 bg-kuro-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-kuro-500/30 hover:bg-kuro-700 transition-all flex items-center justify-center gap-2"
          type="submit"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {member ? 'Guardar Cambios' : 'Confirmar Registro'}
        </motion.button>
        <button
          className="h-14 px-8 rounded-2xl border border-carbon-200 dark:border-carbon-700 text-carbon-500 dark:text-carbon-400 font-bold uppercase tracking-widest text-xs hover:bg-carbon-50 dark:hover:bg-carbon-800 transition-all"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function CheckIcon({ className, strokeWidth = 2 }: { className?: string, strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
