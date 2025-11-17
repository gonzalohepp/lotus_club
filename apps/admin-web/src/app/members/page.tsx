'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../layouts/AdminLayout'
import { Plus, Search, Check } from 'lucide-react'

import MemberFilters from '../components/members/MemberFilters'
import MemberList from '../components/members/MemberList'
import MemberModal from '../components/members/MemberModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Row = {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  access_code: string | null
  membership_type: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | null
  next_payment_due: string | null
  status?: 'activo' | 'inactivo'
  class_ids?: number[]
  class_names?: string[]
}

type ClassRow = { id: number; name: string }

/** ===============================
 *  Overlay de éxito centrado
 *  =============================== */
function CenterSuccessOverlay({
  message,
  onClose,
  showIcon = true
}: {
  message: string
  onClose: () => void
  showIcon?: boolean
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t1 = setTimeout(() => setVisible(true), 10)
    const t2 = setTimeout(() => setVisible(false), 1800)
    const t3 = setTimeout(onClose, 2000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [onClose])

  const node = (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="absolute inset-0 bg-black/20" />
      <div
        className={`relative mx-4 w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl transition-transform duration-200 ${
          visible ? 'scale-100' : 'scale-95'
        }`}
      >
        {showIcon && (
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-10 w-10 text-emerald-600" strokeWidth={3} />
          </div>
        )}
        <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
          {message}
        </h3>
      </div>
    </div>
  )

  return mounted ? createPortal(node, document.body) : null
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
    const base = (parts[0][0] ?? '') + (parts[parts.length - 1] ?? '')
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
      <div className="mb-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">
            Gestión de Miembros
          </h1>
        </div>
        <button
          onClick={onCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nuevo Miembro
          </span>
        </button>
      </div>

      {/* Buscador */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            placeholder="Buscar por nombre, email, teléfono o código…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10"
          />
        </div>
      </div>

      <MemberFilters value={filters} onChange={setFilters} classes={classes} />
      <MemberList members={filtered} loading={loading} onEdit={onEdit} onDelete={onDelete} />
      <MemberModal
        open={open}
        onClose={() => setOpen(false)}
        member={editing}
        onSubmit={onSubmit}
      />

      {successMsg && (
        <CenterSuccessOverlay message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}
    </AdminLayout>
  )
}
