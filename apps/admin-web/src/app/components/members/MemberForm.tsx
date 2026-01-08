'use client'

import { useEffect, useState } from 'react'
import { addMonths } from 'date-fns'
import { motion } from 'framer-motion'
import { User, Mail, Phone, Hash, Shield, Calendar, BookOpen, AlertCircle, Save, X as XIcon } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { MemberRow } from '@/types/member'

export default function MemberForm({
  member,
  onSubmit,
  onCancel,
}: {
  member: MemberRow | null
  onSubmit: (payload: any) => Promise<void>
  onCancel: () => void
}) {
  const [classes, setClasses] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    access_code: '',
    classes: [] as number[],
    membership_type: 'mensual',
    last_payment_date: new Date().toISOString().slice(0, 10),
    next_payment_due: new Date(addMonths(new Date(), 1)).toISOString().slice(0, 10),
    emergency_contact: '',
    notes: '',
  })
  const [manualCode, setManualCode] = useState(false)

  useEffect(() => {
    supabase.from('classes').select('id,name,price,color').then(({ data }) => setClasses(data ?? []))
  }, [])

  useEffect(() => {
    if (member) {
      setForm((prev) => ({
        ...prev,
        full_name: [member.first_name, member.last_name].filter(Boolean).join(' '),
        email: member.email ?? '',
        phone: member.phone ?? '',
        access_code: member.access_code ?? '',
        classes: member.class_ids ?? [],
        membership_type: (member.membership_type ? ({
          monthly: 'mensual', quarterly: 'trimestral', semiannual: 'semestral', annual: 'anual'
        } as any)[member.membership_type] : 'mensual'),
        next_payment_due: member.end_date ? new Date(member.end_date).toISOString().slice(0, 10) : new Date(addMonths(new Date(), 1)).toISOString().slice(0, 10),
        emergency_contact: member.emergency_phone ?? '',
        notes: member.notes ?? '',
      }))
    }
  }, [member])

  // Autocomplete Access Code
  useEffect(() => {
    if (manualCode || member) return // Don't autocomplete if manual or editing
    const parts = form.full_name.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (parts.length < 2) {
      if (form.full_name === '') setForm(f => ({ ...f, access_code: '' }))
      return
    }
    const suggested = (parts[0][0] + parts.slice(1).join('')).replace(/[^a-z0-9]/g, '')
    setForm(f => ({ ...f, access_code: suggested }))
  }, [form.full_name, manualCode, member])

  const handleMembershipChange = (v: string) => {
    const months = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }[v] ?? 1
    const baseDate = form.last_payment_date ? new Date(form.last_payment_date) : new Date()
    setForm(s => ({
      ...s,
      membership_type: v,
      next_payment_due: new Date(addMonths(baseDate, months)).toISOString().slice(0, 10)
    }))
  }

  const toggleClass = (id: number) => {
    setForm(s => ({
      ...s,
      classes: s.classes.includes(id) ? s.classes.filter(x => x !== id) : [...s.classes, id]
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit(form)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = "w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 pl-11 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all font-sans"

  return (
    <form onSubmit={submit} className="space-y-10">
      {/* --- Personal Section --- */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <User className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Información Personal</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              className={inputClass}
              placeholder="Nombre completo *"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>

          <div className="relative group">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
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
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
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
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              className={inputClass}
              placeholder="Teléfono móvil"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="relative group">
            <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              className={inputClass}
              placeholder="Contacto de emergencia"
              value={form.emergency_contact}
              onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* --- Membership Section --- */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Shield className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Membresía y Pagos</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="relative group">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <select
              className={`${inputClass} appearance-none cursor-pointer focus:ring-emerald-500/10 focus:border-emerald-500/50`}
              value={form.membership_type}
              onChange={(e) => handleMembershipChange(e.target.value)}
            >
              <option value="mensual">Plan Mensual</option>
              <option value="trimestral">Plan Trimestral</option>
              <option value="semestral">Plan Semestral</option>
              <option value="anual">Plan Anual</option>
            </select>
          </div>

          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              className={`${inputClass} focus:ring-emerald-500/10 focus:border-emerald-500/50`}
              type="date"
              value={form.last_payment_date}
              onChange={(e) => setForm({ ...form, last_payment_date: e.target.value })}
            />
          </div>

          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              className={`${inputClass} focus:ring-emerald-500/10 focus:border-emerald-500/50`}
              type="date"
              value={form.next_payment_due}
              onChange={(e) => setForm({ ...form, next_payment_due: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* --- Classes Section --- */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <BookOpen className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Inscripción a Clases</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {classes.map(c => (
            <label
              key={c.id}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${form.classes.includes(c.id)
                ? 'bg-blue-50 border-blue-200 shadow-sm'
                : 'bg-white border-slate-100 hover:border-slate-300'
                }`}
            >
              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${form.classes.includes(c.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'
                }`}>
                {form.classes.includes(c.id) && <CheckIcon className="w-3 h-3" strokeWidth={4} />}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={form.classes.includes(c.id)}
                onChange={() => toggleClass(c.id)}
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 leading-none">{c.name}</p>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">${Number(c.price).toLocaleString()}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* --- Notes --- */}
      <section>
        <textarea
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all min-h-[120px]"
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
          className="flex-1 h-14 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
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
          className="h-14 px-8 rounded-2xl border border-slate-200 text-slate-500 font-bold uppercase tracking-widest text-xs hover:bg-slate-50 transition-all"
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
