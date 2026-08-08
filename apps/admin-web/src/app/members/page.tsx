'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '../layouts/AdminLayout'
import { Search, Check, Users, UserPlus, Filter, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import { toast } from 'sonner'
import MemberFilters from '../components/members/MemberFilters'
import MemberList from '../components/members/MemberList'
import MemberModal from '../components/members/MemberModal'
import { todayAR } from '@/lib/dateUtils'
import { addMonths, lastDayOfMonth } from 'date-fns'

import { MemberRow as Row, ClassRow, MemberPayload } from '@/types/member'
import { useTenant } from '@/lib/tenant/context'
import { NO_DOJO } from '@/lib/tenant/constants'

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
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-carbon-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-xl"
    >
      <div className="w-8 h-8 rounded-full bg-kuro-500/20 flex items-center justify-center text-kuro-500">
        <Check className="w-5 h-5" />
      </div>
      <p className="font-bold text-sm tracking-tight">{message}</p>
      <button onClick={onClose} className="ml-2 text-carbon-400 hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

function MembersContent() {
  const searchParams = useSearchParams()
  // Sede activa: todo lo de esta pantalla se lee y escribe scopeado a ella.
  const { activeDojo } = useTenant()
  const dojoId = activeDojo?.id
  const [members, setMembers] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    status: 'todos' as 'todos' | 'activo' | 'vencido',
    className: 'todas' as 'todas' | string,
    role: 'todos' as 'todos' | 'admin' | 'member' | 'instructor' | 'becado'
  })
  const [q, setQ] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6

  // --- CARGA ---
  const load = async () => {
    setLoading(true)
    // RLS ya impide leer otras sedes, pero un admin de dos sedes las vería
    // mezcladas sin este filtro: la vista devuelve una fila por (dojo, persona).
    if (!dojoId) { setLoading(false); return }

    const { data, error } = await supabase
      .from('members_with_status')
      .select('*')
      .eq('dojo_id', dojoId)
      .order('last_name', { ascending: true, nullsFirst: true })

    if (error) console.error('[members] load error:', error)

    const rawMembers = (data ?? []) as Row[]
    const userIds = rawMembers.map((m) => m.user_id).filter(Boolean)
    const avatarMap: Record<string, string | null> = {}

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, avatar_url')
        .in('user_id', userIds)

      if (profiles) {
        profiles.forEach((p: { user_id: string; avatar_url: string | null }) => { avatarMap[p.user_id] = p.avatar_url })
      }
    }

    const membersWithAvatars = rawMembers.map((member) => ({
      ...member,
      avatar_url: avatarMap[member.user_id] || null
    }))

    setMembers(membersWithAvatars as Row[])
    setLoading(false)
  }

  useEffect(() => { load() }, [dojoId])

  useEffect(() => {
    const loadClasses = async () => {
      if (!dojoId) return
      const { data } = await supabase
        .from('classes')
        .select('id,name')
        .eq('dojo_id', dojoId)
        .order('name')
      setClasses((data ?? []) as ClassRow[])
    }
    loadClasses()
  }, [dojoId])

  useEffect(() => {
    const newId = searchParams.get('new_id')
    const newEmail = searchParams.get('new_email')
    const newName = searchParams.get('new_name')

    if (newId && newEmail) {
      const [first, ...rest] = (newName || '').split(' ')
      const last = rest.join(' ')
      setEditing(null)
      setEditing({
        user_id: newId,
        email: newEmail,
        first_name: first || null,
        last_name: last || null,
        phone: null,
        emergency_phone: null,
        notes: 'Registro pendiente desde login',
        access_code: null,
        next_payment_due: null
      })
      setOpen(true)
    }
  }, [searchParams])

  // --- FILTROS + SEARCH ---
  const filtered = useMemo(() => {
    return members.filter((m) => {
      const full = [m.first_name, m.last_name].filter(Boolean).join(' ').trim()
      const derived = m.status || 'vencido'
      const statusOk = filters.status === 'todos' || filters.status === derived
      const classOk = filters.className === 'todas' || (m.class_names ?? []).some((n) => n === filters.className)
      const roleOk = filters.role === 'todos' || m.role === filters.role
      const qOk =
        !q ||
        full.toLowerCase().includes(q.toLowerCase()) ||
        (m.email ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (m.phone ?? '').includes(q) ||
        (m.access_code ?? '').toLowerCase().includes(q.toLowerCase())
      return statusOk && classOk && qOk && roleOk
    })
  }, [members, filters, q])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filtered, currentPage])

  // --- ACCIONES ---
  const onCreate = () => { setEditing(null); setOpen(true) }
  const onEdit = (m: Row) => { setEditing(m); setOpen(true) }
  const onDelete = async (user_id: string) => { setConfirmingId(user_id) }

  const onQuickRenew = async (m: Row) => {
    const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || 'Socio'
    const confirm = window.confirm(`¿Confirmar renovación rápida de vencimiento para ${fullName}?`)
    if (!confirm) return

    try {
      setLoading(true)
      const todayStr = todayAR()
      const todayDate = new Date(todayStr + 'T12:00:00')
      let baseDate: Date

      if (m.next_payment_due) {
        const currentExpiry = new Date(m.next_payment_due + 'T12:00:00')
        if (currentExpiry < todayDate) {
          baseDate = todayDate
        } else {
          baseDate = currentExpiry
        }
      } else {
        baseDate = todayDate
      }

      const newExpirationStr = lastDayOfMonth(addMonths(baseDate, 1)).toISOString().slice(0, 10)

      const { data: existingMem } = await supabase
        .from('memberships')
        .select('start_date')
        .eq('dojo_id', dojoId ?? NO_DOJO)
        .eq('member_id', m.user_id)
        .maybeSingle()

      const finalStartDate = existingMem?.start_date || todayStr

      const { error: memErr } = await supabase.from('memberships').upsert({
        member_id: m.user_id,
        type: 'monthly',
        start_date: finalStartDate,
        last_payment_date: todayStr,
        end_date: newExpirationStr,
        notes: 'Renovación rápida manual desde administración',
      }, { onConflict: 'dojo_id,member_id' })

      if (memErr) throw memErr

      toast.success('Vencimiento renovado correctamente')
      await load()
    } catch (error: unknown) {
      console.error('[Members] onQuickRenew error:', error)
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error('Error al renovar vencimiento: ' + message)
    } finally {
      setLoading(false)
    }
  }

  const actuallyDelete = async () => {
    if (!confirmingId) return
    const user_id = confirmingId
    try {
      setDeletingId(user_id)
      const res = await fetch('/api/members/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      setConfirmingId(null)
      await load()
      setSuccessMsg('Miembro eliminado correctamente')
      toast.success('Miembro eliminado correctamente')
    } catch (error: unknown) {
      console.error('[Members] onDelete error:', error)
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error('Error eliminando miembro: ' + message)
    } finally {
      setDeletingId(null)
    }
  }

  const generateAccessCode = async (full_name: string) => {
    const parts = full_name.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!parts.length) return ''
    const base = parts[0][0] + parts.slice(1).join('')
    const baseCode = base.replace(/[^a-z0-9]/g, '')
    const { data } = await supabase.from('profiles').select('access_code').not('access_code', 'is', null)
    const used = new Set((data ?? []).map((d) => (d.access_code as string).toLowerCase()))
    if (!used.has(baseCode)) return baseCode
    let i = 2
    while (used.has(baseCode + i)) i++
    return baseCode + i
  }

  const onSubmit = async (payload: MemberPayload) => {
    const [first_name, ...rest] = payload.full_name.trim().split(/\s+/)
    const last_name = rest.join(' ')
    const access_code = payload.access_code?.trim() || (await generateAccessCode(payload.full_name))
    const isUpdate = !!(editing && editing.status)

    try {
      if (isUpdate) {
        const userId = editing!.user_id

        const { error: upErr } = await supabase
          .from('profiles')
          .update({
            first_name, last_name,
            email: payload.email,
            phone: payload.phone ?? null,
            emergency_phone: payload.emergency_contact ?? null,
            notes: payload.notes ?? null,
            access_code: payload.access_code?.trim() || null,
            role: payload.role || 'member'
          })
          .eq('user_id', userId)
        if (upErr) throw upErr

        const { data: existingMem } = await supabase
          .from('memberships')
          .select('start_date')
          .eq('dojo_id', dojoId ?? NO_DOJO)
          .eq('member_id', userId)
          .maybeSingle()

        const { error: memErr } = await supabase
          .from('memberships')
          .upsert(
            {
              dojo_id: dojoId,
              member_id: userId,
              type: 'monthly',
              start_date: existingMem?.start_date || payload.last_payment_date || new Date().toISOString().slice(0, 10),
              last_payment_date: payload.last_payment_date || new Date().toISOString().slice(0, 10),
              end_date: payload.next_payment_due ?? null
            },
            { onConflict: 'member_id' }
          )
        if (memErr) throw memErr

        await supabase.from('class_enrollments').delete().eq('dojo_id', dojoId).eq('user_id', userId)
        if (payload.classes?.length) {
          const { error: enrollErr } = await supabase
            .from('class_enrollments')
            .insert(payload.classes.map((c) => ({
              dojo_id: dojoId,
              user_id: userId,
              class_id: c.class_id,
              is_principal: c.is_principal
            })))
          if (enrollErr) throw enrollErr
        }

        toast.success('Cambios guardados')
      } else {
        const res = await fetch('/api/members/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name, last_name,
            email: payload.email,
            phone: payload.phone ?? null,
            emergency_phone: payload.emergency_contact ?? null,
            notes: payload.notes ?? null,
            access_code,
            last_payment_date: payload.last_payment_date,
            next_payment_due: payload.next_payment_due,
            classes: payload.classes,
            role: payload.role || 'member'
          })
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al crear el miembro')
        }
        toast.success('Usuario creado correctamente')
      }

      setOpen(false)
      load()
    } catch (error: unknown) {
      console.error('[Members] onSubmit error:', error)
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error('Error: ' + message)
    }
  }

  return (
    <AdminLayout>
      <div className="relative min-h-screen">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-kuro-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-kuro-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">

          {/* Header */}
          <header className="mb-6 md:mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kuro-500/10 border border-kuro-500/20 text-kuro-600 dark:text-kuro-400 text-xs font-bold tracking-widest uppercase mb-3">
                <Users className="w-3 h-3" />
                ADMINISTRACIÓN
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
                Gestión de <span className="text-kuro-600 dark:text-kuro-400">Miembros</span>
              </h1>
              <p className="mt-1 text-carbon-500 dark:text-carbon-400 font-medium text-sm md:text-base">
                {activeDojo
                  ? <>Alumnos de <span className="font-black text-carbon-700 dark:text-carbon-200">{activeDojo.name}</span>. Los que des de alta quedan asociados a esta sede.</>
                  : 'Visualiza, filtra y gestiona todos los alumnos del Dojo al instante.'}
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCreate}
              className="group relative overflow-hidden rounded-2xl bg-kuro-600 px-6 py-4 text-white shadow-xl shadow-kuro-500/30 transition-all hover:bg-kuro-700 w-full md:w-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-kuro-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <span className="relative flex items-center justify-center gap-3 font-black uppercase tracking-wider text-sm">
                <UserPlus className="h-5 w-5" />
                Nuevo Alumno
              </span>
            </motion.button>
          </header>

          {/* Buscador y Filtros */}
          <div className="mb-6 space-y-3">
            <div className="relative flex items-center bg-white dark:bg-carbon-800/50 border border-carbon-200 dark:border-carbon-700 rounded-2xl p-2 shadow-sm focus-within:border-kuro-500/50 focus-within:ring-4 focus-within:ring-kuro-500/5 transition-all">
              <Search className="ml-3 h-5 w-5 text-carbon-400 shrink-0" />
              <input
                placeholder="Buscar por nombre, email, teléfono o código…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setCurrentPage(1) }}
                className="h-11 w-full bg-transparent border-none px-3 focus:ring-0 text-carbon-900 dark:text-white placeholder:text-carbon-400 font-medium text-sm"
              />
              {q && (
                <button
                  onClick={() => { setQ(''); setCurrentPage(1) }}
                  className="p-2 hover:bg-carbon-100 dark:hover:bg-carbon-700 rounded-xl text-carbon-400 transition-colors mr-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtros — scroll horizontal en mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-carbon-100/50 dark:bg-carbon-800/50 border border-carbon-200/50 dark:border-carbon-700 rounded-xl text-carbon-500 dark:text-carbon-400 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                <span className="text-xs font-bold uppercase tracking-widest">Filtros</span>
              </div>
              <MemberFilters
                value={filters}
                onChange={(v) => { setFilters(v); setCurrentPage(1) }}
                classes={classes}
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <MemberList members={paginatedMembers} loading={loading} onEdit={onEdit} onDelete={onDelete} onQuickRenew={onQuickRenew} />
          </motion.div>

          {/* Paginación */}
          {!loading && filtered.length > 0 && totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex items-center justify-center gap-2"
            >
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-3 rounded-xl bg-white dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 text-carbon-600 dark:text-carbon-400 hover:bg-carbon-50 dark:hover:bg-carbon-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const showPage = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
                  if (!showPage && page === currentPage - 2) return <span key={page} className="px-2 text-carbon-400">...</span>
                  if (!showPage && page === currentPage + 2) return <span key={page} className="px-2 text-carbon-400">...</span>
                  if (!showPage) return null
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[44px] h-11 rounded-xl font-bold text-sm transition-all ${page === currentPage
                          ? 'bg-kuro-600 text-white shadow-lg shadow-kuro-500/30'
                          : 'bg-white dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 text-carbon-600 dark:text-carbon-400 hover:bg-carbon-50 dark:hover:bg-carbon-700'
                        }`}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-3 rounded-xl bg-white dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 text-carbon-600 dark:text-carbon-400 hover:bg-carbon-50 dark:hover:bg-carbon-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* Resumen */}
          {!loading && filtered.length > 0 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-carbon-500 dark:text-carbon-400 font-medium">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length} miembros
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal confirmación de eliminación */}
      <AnimatePresence>
        {confirmingId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deletingId && setConfirmingId(null)}
              className="absolute inset-0 bg-carbon-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-carbon-900 p-8 shadow-2xl border border-carbon-200 dark:border-carbon-800 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-alert-100 dark:bg-alert-500/10 flex items-center justify-center text-alert-600 mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-carbon-900 dark:text-white tracking-tight mb-2 uppercase">¿Estás seguro?</h3>
              <p className="text-carbon-500 dark:text-carbon-400 text-sm font-medium mb-8">
                Esta acción eliminará permanentemente al miembro, sus inscripciones y su historial. No se puede deshacer.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={actuallyDelete}
                  disabled={deletingId !== null}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-alert-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-alert-500/30 hover:bg-alert-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {deletingId ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />ELIMINANDO...</>
                  ) : (
                    'SÍ, ELIMINAR MIEMBRO'
                  )}
                </button>
                <button
                  onClick={() => setConfirmingId(null)}
                  disabled={deletingId !== null}
                  className="w-full py-4 rounded-2xl bg-carbon-100 dark:bg-carbon-800 text-carbon-600 dark:text-carbon-400 font-black uppercase tracking-widest text-xs hover:bg-carbon-200 dark:hover:bg-carbon-700 transition-all disabled:opacity-50"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-carbon-400">Cargando...</div>}>
      <MembersContent />
    </Suspense>
  )
}