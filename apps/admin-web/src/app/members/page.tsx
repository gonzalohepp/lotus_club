'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '../layouts/AdminLayout'
import { Plus, Search, Check, Users, UserPlus, Filter, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import MemberFilters from '../components/members/MemberFilters'
import MemberList from '../components/members/MemberList'
import MemberModal from '../components/members/MemberModal'

import { MemberRow as Row, ClassRow } from '@/types/member'

function SuccessToast({ message, onClose }: { message: string, onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-xl"
    >
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
        <Check className="w-5 h-5" />
      </div>
      <p className="font-bold text-sm tracking-tight">{message}</p>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

export default function MembersPage() {
  const [members, setMembers] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    status: 'todos' as 'todos' | 'activo' | 'inactivo',
    membership: 'todos' as 'todos' | 'monthly' | 'quarterly' | 'semiannual' | 'annual',
    className: 'todas' as 'todas' | string
  })
  const [q, setQ] = useState('')

  // --- CARGA ---
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('members_with_status')
      .select('*')
      .order('last_name', { ascending: true, nullsFirst: true })

    if (error) console.error('[members] load error:', error)
    setMembers((data ?? []) as Row[])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const loadClasses = async () => {
      const { data } = await supabase
        .from('classes')
        .select('id,name')
        .order('name')
      setClasses((data ?? []) as ClassRow[])
    }
    loadClasses()
  }, [])

  // --- FILTROS + SEARCH ---
  const filtered = useMemo(() => {
    const today = new Date(new Date().toDateString())
    return members.filter((m) => {
      const full = [m.first_name, m.last_name].filter(Boolean).join(' ').trim()
      const derived =
        m.status ??
        (m.next_payment_due && new Date(m.next_payment_due) >= today
          ? 'activo'
          : 'inactivo')
      const statusOk = filters.status === 'todos' || filters.status === derived
      const membOk =
        filters.membership === 'todos' || m.membership_type === filters.membership
      const classOk =
        filters.className === 'todas' ||
        (m.class_names ?? []).some((n) => n === filters.className)
      const qOk =
        !q ||
        full.toLowerCase().includes(q.toLowerCase()) ||
        (m.email ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (m.phone ?? '').includes(q) ||
        (m.access_code ?? '').toLowerCase().includes(q.toLowerCase())
      return statusOk && membOk && classOk && qOk
    })
  }, [members, filters, q])

  // --- ACCIONES ---
  const onCreate = () => {
    setEditing(null)
    setOpen(true)
  }
  const onEdit = (m: Row) => {
    setEditing(m)
    setOpen(true)
  }

  /** Paso 4.1: eliminar con RPC admin_delete_member */
  const onDelete = async (user_id: string) => {
    if (!confirm('¿Eliminar este miembro?')) return
    const { error } = await supabase.rpc('admin_delete_member', { p_user_id: user_id })
    if (error) {
      alert('Error eliminando miembro: ' + error.message)
      return
    }
    await load()
    setSuccessMsg('Miembro eliminado correctamente')
  }

  // genera access_code único
  const generateAccessCode = async (full_name: string) => {
    const parts = full_name.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!parts.length) return ''
    const base = parts[0][0] + parts.slice(1).join('')
    const baseCode = base.replace(/[^a-z0-9]/g, '')
    const { data } = await supabase
      .from('profiles')
      .select('access_code')
      .not('access_code', 'is', null)
    const used = new Set((data ?? []).map((d) => (d.access_code as string).toLowerCase()))
    if (!used.has(baseCode)) return baseCode
    let i = 2
    while (used.has(baseCode + i)) i++
    return baseCode + i
  }

  /** Paso 4.2: upsert de membresía con onConflict: 'member_id' */
  const onSubmit = async (payload: {
    full_name: string
    email: string
    phone?: string
    emergency_contact?: string
    notes?: string
    membership_type: 'mensual' | 'trimestral' | 'semestral' | 'anual'
    last_payment_date?: string
    next_payment_due?: string
    classes: number[]
    access_code?: string
  }) => {
    const typeMap: Record<string, 'monthly' | 'quarterly' | 'semiannual' | 'annual'> = {
      mensual: 'monthly',
      trimestral: 'quarterly',
      semestral: 'semiannual',
      anual: 'annual'
    }

    const [first_name, ...rest] = payload.full_name.trim().split(/\s+/)
    const last_name = rest.join(' ')
    const access_code =
      payload.access_code?.trim() || (await generateAccessCode(payload.full_name))

    // EDITAR
    if (editing) {
      const userId = editing.user_id

      // perfiles
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          first_name,
          last_name,
          email: payload.email,
          phone: payload.phone ?? null,
          emergency_phone: payload.emergency_contact ?? null,
          notes: payload.notes ?? null
        })
        .eq('user_id', userId)
      if (upErr) {
        alert('Error actualizando perfil: ' + upErr.message)
        return
      }

      // membresía (upsert 1 por member_id)
      const { error: memErr } = await supabase
        .from('memberships')
        .upsert(
          {
            member_id: userId,
            type: typeMap[payload.membership_type],
            start_date:
              payload.last_payment_date ?? new Date().toISOString().slice(0, 10),
            end_date: payload.next_payment_due ?? null
          },
          { onConflict: 'member_id' }
        )
      if (memErr) {
        alert('Error actualizando membresía: ' + memErr.message)
        return
      }

      // clases: simple (borrar e insertar)
      await supabase.from('class_enrollments').delete().eq('user_id', userId)
      if (payload.classes?.length) {
        await supabase
          .from('class_enrollments')
          .insert(payload.classes.map((class_id) => ({ user_id: userId, class_id })))
      }

      setOpen(false)
      await load()
      setSuccessMsg('Cambios guardados')
      return
    }

    // CREAR
    const { data: created, error } = await supabase
      .from('profiles')
      .insert({
        user_id: crypto.randomUUID(),
        role: 'member',
        first_name,
        last_name,
        email: payload.email,
        phone: payload.phone ?? null,
        emergency_phone: payload.emergency_contact ?? null,
        notes: payload.notes ?? null,
        access_code
      })
      .select('user_id')
      .maybeSingle()

    if (error || !created) {
      alert('Error creando miembro: ' + (error?.message ?? 'desconocido'))
      return
    }
    const userId = created.user_id as string

    // membresía (upsert garantiza una por miembro)
    const { error: memErr } = await supabase
      .from('memberships')
      .upsert(
        {
          member_id: userId,
          type: typeMap[payload.membership_type],
          start_date:
            payload.last_payment_date ?? new Date().toISOString().slice(0, 10),
          end_date: payload.next_payment_due ?? null
        },
        { onConflict: 'member_id' }
      )
    if (memErr) {
      alert('Error guardando membresía: ' + memErr.message)
      return
    }

    // clases
    if (payload.classes?.length) {
      await supabase
        .from('class_enrollments')
        .insert(payload.classes.map((class_id) => ({ user_id: userId, class_id })))
    }

    setOpen(false)
    await load()
    setSuccessMsg('Usuario creado correctamente')
  }

  return (
    <AdminLayout>
      <div className="relative min-h-screen">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-xs font-bold tracking-widest uppercase mb-4">
                <Users className="w-3 h-3" />
                ADMINISTRACIÓN
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight md:text-5xl">
                Gestión de <span className="text-blue-600">Miembros</span>
              </h1>
              <p className="mt-2 text-slate-500 font-medium">
                Visualiza, filtra y gestiona todos los alumnos del Dojo al instante.
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCreate}
              className="group relative overflow-hidden rounded-2xl bg-blue-600 px-8 py-4 text-white shadow-xl shadow-blue-500/30 transition-all hover:bg-blue-700"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <span className="relative flex items-center justify-center gap-3 font-black uppercase tracking-wider text-sm">
                <UserPlus className="h-5 w-5" />
                Nuevo Alumno
              </span>
            </motion.button>
          </header>

          {/* Buscador y Filtros */}
          <div className="mb-8 space-y-4">
            <div className="group relative">
              <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl group-focus-within:bg-blue-500/10 transition-colors" />
              <div className="relative flex items-center bg-white/70 backdrop-blur-md border border-slate-200 rounded-2xl p-2 shadow-sm focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/5 transition-all">
                <Search className="ml-4 h-6 w-6 text-slate-400" />
                <input
                  placeholder="Buscar por nombre, email, teléfono o código…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-12 w-full bg-transparent border-none px-4 focus:ring-0 text-slate-900 placeholder:text-slate-400 font-medium"
                />
                {q && (
                  <button onClick={() => setQ('')} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors mr-2">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/50 border border-slate-200/50 rounded-xl text-slate-500">
                <Filter className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Filtros</span>
              </div>
              <MemberFilters value={filters} onChange={setFilters} classes={classes} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <MemberList members={filtered} loading={loading} onEdit={onEdit} onDelete={onDelete} />
          </motion.div>
        </div>
      </div>

      <MemberModal
        open={open}
        onClose={() => setOpen(false)}
        member={editing}
        onSubmit={onSubmit}
      />

      <AnimatePresence>
        {successMsg && (
          <SuccessToast message={successMsg} onClose={() => setSuccessMsg(null)} />
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
