'use client'
import { addMonths } from 'date-fns'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function MemberForm({
  member,
  onSubmit,
  onCancel,
}: {
  member: any | null
  onSubmit: (payload:any)=>Promise<void>
  onCancel: ()=>void
}) {
  const [classes, setClasses] = useState<any[]>([])
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    access_code: '',
    classes: [] as number[],
    membership_type: 'mensual',
    last_payment_date: new Date().toISOString().slice(0,10),
    next_payment_due: new Date(addMonths(new Date(),1)).toISOString().slice(0,10),
    emergency_contact: '',
    notes: '',
  })

  useEffect(() => {
    supabase.from('classes').select('id,name,price').then(({data})=> setClasses(data ?? []))
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
          monthly:'mensual', quarterly:'trimestral', semiannual:'semestral', annual:'anual'
        } as any)[member.membership_type] : 'mensual'),
        next_payment_due: member.end_date ? new Date(member.end_date).toISOString().slice(0,10) : new Date(addMonths(new Date(),1)).toISOString().slice(0,10),
        emergency_contact: member.emergency_phone ?? '',
        notes: member.notes ?? '',
      }))
    }
  }, [member])

  const handleMembershipChange = (v:string) => {
    const months = { mensual:1, trimestral:3, semestral:6, anual:12 }[v] ?? 1
    setForm(s => ({
      ...s,
      membership_type: v,
      next_payment_due: new Date(addMonths(new Date(), months)).toISOString().slice(0,10)
    }))
  }

  const toggleClass = (id:number) => {
    setForm(s => ({
      ...s,
      classes: s.classes.includes(id) ? s.classes.filter(x=>x!==id) : [...s.classes, id]
    }))
  }

  const submit = async (e:React.FormEvent) => {
    e.preventDefault()
    await onSubmit(form)
  }

  return (
    <div className="rounded-xl border bg-white p-6 mb-6">
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-semibold">{member ? 'Editar Miembro' : 'Nuevo Miembro'}</h3>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-900">✕</button>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <input className="h-10 rounded-lg border px-3" placeholder="Nombre completo *"
               value={form.full_name} onChange={(e)=>setForm({...form, full_name:e.target.value})} required />
        <input className="h-10 rounded-lg border px-3 font-mono" placeholder="Código de acceso"
               value={form.access_code} onChange={(e)=>setForm({...form, access_code:e.target.value})} />
        <input className="h-10 rounded-lg border px-3 sm:col-span-2" type="email" placeholder="Email *"
               value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} required />
        <input className="h-10 rounded-lg border px-3" placeholder="Teléfono"
               value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} />
        <input className="h-10 rounded-lg border px-3" placeholder="Contacto de emergencia"
               value={form.emergency_contact} onChange={(e)=>setForm({...form, emergency_contact:e.target.value})} />

        <select className="h-10 rounded-lg border px-3"
                value={form.membership_type} onChange={(e)=>handleMembershipChange(e.target.value)}>
          <option value="mensual">Mensual</option>
          <option value="trimestral">Trimestral</option>
          <option value="semestral">Semestral</option>
          <option value="anual">Anual</option>
        </select>

        <div className="flex gap-2">
          <input className="h-10 rounded-lg border px-3 w-1/2" type="date"
                 value={form.last_payment_date} onChange={(e)=>setForm({...form, last_payment_date:e.target.value})}/>
          <input className="h-10 rounded-lg border px-3 w-1/2" type="date"
                 value={form.next_payment_due} onChange={(e)=>setForm({...form, next_payment_due:e.target.value})}/>
        </div>

        <textarea className="rounded-lg border px-3 py-2 sm:col-span-2" rows={3} placeholder="Notas"
                  value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})}/>

        <div className="sm:col-span-2">
          <p className="text-sm font-medium mb-2">Clases</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {classes.map(c => (
              <label key={c.id} className="flex items-center gap-2 border rounded-lg p-3 hover:bg-slate-50">
                <input type="checkbox" checked={form.classes.includes(c.id)} onChange={()=>toggleClass(c.id)}/>
                <span className="flex-1">{c.name}</span>
                <span className="text-sm text-slate-500">${c.price ?? 0}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2 flex gap-2">
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" type="submit">
            Guardar Miembro
          </button>
          <button className="rounded-lg border px-4 py-2 hover:bg-slate-50" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
