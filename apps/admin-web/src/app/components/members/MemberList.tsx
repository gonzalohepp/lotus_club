'use client'

import { Calendar, Mail, Phone, Pencil, Trash2, User as UserIcon, Hash, Clock, MessageCircle, X, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { MemberRow } from '@/types/member'
import { useTenant } from '@/lib/tenant/context'

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : '—'

/* ── Bottom Sheet de acciones (mobile) ── */
function ActionSheet({
  open,
  member,
  onClose,
  onEdit,
  onDelete,
  onQuickRenew,
}: {
  open: boolean
  member: MemberRow | null
  onClose: () => void
  onEdit: (m: MemberRow) => void
  onDelete: (id: string) => void
  onQuickRenew: (m: MemberRow) => void
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Nombre con el que se firma hacia el alumno: el display_name configurado en
  // /superadmin, o el de la organización.
  const { branding, org, allows } = useTenant()
  const marca = branding.display_name || org?.name || 'tu dojo'

  // Renovar, editar y eliminar son del administrador de la sede. Los roles de
  // marca ven la ficha completa del alumno pero no la modifican.
  const canManage = allows('manageMembers')

  if (!member) return null
  const fullName = [member.first_name, member.last_name].filter(Boolean).join(' ').trim()
  const isActive = member.status === 'activo'

  const handleWhatsApp = () => {
    const msg = `Hola ${fullName || 'Alumno'}! Te escribimos de ${marca}. 🥋`
    const phone = member.phone?.replace(/\D/g, '') || ''
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-carbon-900 border-t border-carbon-200 dark:border-white/10 rounded-t-[2rem] pb-safe"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-carbon-300 dark:bg-white/20" />
            </div>

            {/* Member info */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-carbon-100 dark:border-white/5">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-carbon-100 dark:bg-carbon-800 flex items-center justify-center shrink-0">
                {member.avatar_url ? (
                  <Image src={member.avatar_url} alt={fullName} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  <UserIcon className="w-5 h-5 text-carbon-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-carbon-900 dark:text-white text-sm truncate">{fullName || 'Sin nombre'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-kuro-100 text-kuro-600 dark:bg-kuro-500/10 dark:text-kuro-400' : 'bg-alert-100 text-alert-600 dark:bg-alert-500/10 dark:text-alert-400'}`}>
                    {isActive ? 'Activo' : 'Vencido'}
                  </span>
                  {member.access_code && (
                    <span className="text-[9px] font-bold text-carbon-400 uppercase tracking-widest flex items-center gap-0.5">
                      <Hash className="w-2.5 h-2.5" />{member.access_code}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-carbon-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                <X className="w-4 h-4 text-carbon-500 dark:text-white" />
              </button>
            </div>

            {/* Acciones */}
            <div className="p-4 space-y-2">
              {canManage && (
                <>
                  <button
                    onClick={() => { onQuickRenew(member); onClose() }}
                    className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-kuro-600 text-white font-bold text-sm active:scale-95 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Renovar vencimiento
                  </button>
                  <button
                    onClick={() => { onEdit(member); onClose() }}
                    className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-carbon-900 dark:bg-kuro-600 text-white font-bold text-sm active:scale-95 transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar miembro
                  </button>
                </>
              )}
              <button
                onClick={handleWhatsApp}
                className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-kuro-50 dark:bg-kuro-500/10 text-kuro-600 dark:text-kuro-400 font-bold text-sm border border-kuro-100 dark:border-kuro-500/20 active:scale-95 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar WhatsApp
              </button>
              {canManage && (
                <button
                  onClick={() => { onDelete(member.user_id); onClose() }}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-alert-50 dark:bg-alert-500/10 text-alert-600 dark:text-alert-400 font-bold text-sm border border-alert-100 dark:border-alert-500/20 active:scale-95 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar miembro
                </button>
              )}
            </div>

            {/* Safe area bottom padding */}
            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ── Card mobile compacta ── */
function MobileCard({
  m,
  onTap,
}: {
  m: MemberRow
  onTap: () => void
}) {
  const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ').trim()
  const isActive = m.status === 'activo'

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className="w-full text-left bg-white dark:bg-carbon-900 border border-carbon-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm active:shadow-none transition-all"
    >
      <div className={`h-1 w-full ${isActive ? 'bg-kuro-500' : 'bg-alert-500'}`} />
      <div className="flex items-center gap-3 p-4">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-carbon-100 dark:bg-carbon-800 flex items-center justify-center">
            {m.avatar_url ? (
              <Image src={m.avatar_url} alt={fullName} width={48} height={48} className="object-cover w-full h-full" />
            ) : (
              <UserIcon className="w-6 h-6 text-carbon-400" />
            )}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-md border-2 border-white dark:border-carbon-900 ${isActive ? 'bg-kuro-500' : 'bg-alert-500'}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-black text-carbon-900 dark:text-white text-sm truncate leading-tight">
              {fullName || 'Sin nombre'}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {m.role && m.role !== 'member' && (
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${m.role === 'admin' ? 'bg-kuro-100 text-kuro-600 dark:bg-kuro-500/10 dark:text-kuro-400' :
                    m.role === 'instructor' ? 'bg-kuro-100 text-kuro-600 dark:bg-kuro-500/10 dark:text-kuro-400' :
                      'bg-warn-100 text-warn-600 dark:bg-warn-500/10 dark:text-warn-400'
                  }`}>
                  {m.role}
                </span>
              )}
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isActive ? 'bg-kuro-100 text-kuro-600 dark:bg-kuro-500/10 dark:text-kuro-400' : 'bg-alert-100 text-alert-600 dark:bg-alert-500/10 dark:text-alert-400'}`}>
                {isActive ? 'Activo' : 'Vencido'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {m.access_code && (
              <span className="text-[9px] font-bold text-carbon-400 uppercase tracking-widest flex items-center gap-0.5">
                <Hash className="w-2.5 h-2.5" />{m.access_code}
              </span>
            )}
            {m.phone && (
              <span className="text-[10px] text-carbon-500 dark:text-carbon-400 flex items-center gap-1">
                <Phone className="w-2.5 h-2.5" />{m.phone}
              </span>
            )}
            {m.next_payment_due && (
              <span className={`text-[10px] flex items-center gap-1 font-medium ${isActive ? 'text-carbon-500 dark:text-carbon-400' : 'text-alert-500 font-bold'}`}>
                <Calendar className="w-2.5 h-2.5" />
                {m.next_payment_due === '2099-12-31' ? 'Vitalicia' : fmtDate(m.next_payment_due)}
              </span>
            )}
          </div>

          {m.class_names && m.class_names.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {m.class_names.map((cn, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-kuro-50 dark:bg-kuro-500/10 text-kuro-600 dark:text-kuro-400 text-[8px] font-bold border border-kuro-100 dark:border-kuro-500/20">
                  {cn}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  )
}

/* ── Card desktop (original) ── */
function DesktopCard({
  m,
  idx,
  onEdit,
  onDelete,
  onQuickRenew,
}: {
  m: MemberRow
  idx: number
  onEdit: (m: MemberRow) => void
  onDelete: (id: string) => void
  onQuickRenew: (m: MemberRow) => void
}) {
  // Firma hacia el alumno: el nombre configurado en /superadmin.
  const { branding, org, allows } = useTenant()
  const marca = branding.display_name || org?.name || 'tu dojo'
  const canManage = allows('manageMembers')

  const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ').trim()
  const isActive = m.status === 'activo'

  return (
    <motion.div
      key={m.user_id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.05 }}
      className="group relative overflow-hidden rounded-3xl bg-white border border-carbon-200 shadow-sm hover:shadow-xl hover:shadow-kuro-500/5 hover:-translate-y-1 transition-all duration-300"
    >
      <div className={`h-1.5 w-full ${isActive ? 'bg-kuro-500' : 'bg-alert-500'}`} />

      <div className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-carbon-100 border border-carbon-200 flex items-center justify-center shadow-inner">
              {m.avatar_url ? (
                <div className="relative w-full h-full">
                  <Image src={m.avatar_url} alt={fullName} className="object-cover" fill />
                </div>
              ) : (
                <UserIcon className="w-8 h-8 text-carbon-400" />
              )}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-white flex items-center justify-center shadow-sm ${isActive ? 'bg-kuro-500' : 'bg-alert-500'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-black text-carbon-900 tracking-tight leading-tight group-hover:text-kuro-600 transition-colors">
              {fullName || 'Sin Nombre'}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-carbon-400 tracking-widest uppercase">
              <Hash className="w-3 h-3" />
              {m.access_code || '---'}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${isActive ? 'bg-kuro-50 text-kuro-600 border-kuro-100' : 'bg-alert-50 text-alert-600 border-alert-100'}`}>
              {isActive ? 'Activo' : 'Vencido'}
            </div>
            {m.role && m.role !== 'member' && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${m.role === 'admin' ? 'bg-kuro-50 text-kuro-600 border-kuro-100' :
                  m.role === 'instructor' ? 'bg-kuro-50 text-kuro-600 border-kuro-100' :
                    'bg-warn-50 text-warn-600 border-warn-100'
                }`}>
                {m.role}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 pt-4 border-t border-carbon-100">
            <div className="flex items-center gap-3 text-sm font-medium text-carbon-600">
              <div className="w-8 h-8 rounded-lg bg-carbon-50 flex items-center justify-center text-carbon-400 border border-carbon-100">
                <Mail className="w-4 h-4" />
              </div>
              <span className="truncate">{m.email || '---'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-carbon-600">
              <div className="w-8 h-8 rounded-lg bg-carbon-50 flex items-center justify-center text-carbon-400 border border-carbon-100">
                <Phone className="w-4 h-4" />
              </div>
              <span>{m.phone || '---'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-carbon-600">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${isActive ? 'bg-kuro-50 text-kuro-500 border-kuro-100' : 'bg-alert-50 text-alert-500 border-alert-100'}`}>
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-carbon-400 uppercase leading-none mb-0.5">Vencimiento</span>
                <span className={isActive ? 'text-carbon-900' : 'text-alert-600 font-bold'}>
                  {m.next_payment_due === '2099-12-31' ? 'VITALICIA' : fmtDate(m.next_payment_due)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-carbon-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3 h-3 text-carbon-400" />
              <span className="text-[10px] font-black text-carbon-400 uppercase tracking-widest">Clases Inscritas</span>
            </div>
            {m.class_names && m.class_names.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {m.class_names.map((cn, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-kuro-50 text-kuro-600 text-[10px] font-bold border border-kuro-100">
                    {cn}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-carbon-400 italic">Sin clases asignadas</span>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-2">
          {canManage && (
            <button
              onClick={() => onQuickRenew(m)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-kuro-600 text-white font-black uppercase tracking-wider text-xs hover:bg-kuro-700 active:scale-95 transition-all shadow-md shadow-kuro-600/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              RENOVAR VENCIMIENTO
            </button>
          )}
          <div className="flex gap-2">
            {canManage && (
              <button
                onClick={() => onEdit(m)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-carbon-900 text-white font-bold text-xs hover:bg-kuro-600 transition-colors shadow-lg shadow-carbon-900/10"
              >
                <Pencil className="w-3 h-3" />
                EDITAR
              </button>
            )}
            <button
              onClick={() => {
                const name = fullName || 'Alumno'
                const msg = `Hola ${name}! Te escribimos de ${marca}. 🥋`
                const phone = m.phone?.replace(/\D/g, '') || ''
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
              }}
              className={`${canManage ? 'p-2.5' : 'flex-1 justify-center gap-2 py-2.5'} flex items-center rounded-xl border border-carbon-200 text-carbon-400 hover:text-kuro-500 hover:border-kuro-200 hover:bg-kuro-50 transition-all`}
            >
              <MessageCircle className="w-4 h-4" />
              {!canManage && <span className="text-xs font-bold">WHATSAPP</span>}
            </button>
            {canManage && (
              <button
                onClick={() => onDelete(m.user_id)}
                className="p-2.5 rounded-xl border border-carbon-200 text-carbon-400 hover:text-alert-500 hover:border-alert-200 hover:bg-alert-50 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Componente principal ── */
export default function MemberList({
  members,
  loading,
  onEdit,
  onDelete,
  onQuickRenew,
}: {
  members: MemberRow[]
  loading: boolean
  onEdit: (m: MemberRow) => void
  onDelete: (id: string) => void
  onQuickRenew: (m: MemberRow) => void
}) {
  const [sheetMember, setSheetMember] = useState<MemberRow | null>(null)

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-carbon-100 dark:bg-carbon-800/50 md:h-28 md:rounded-3xl" />
        ))}
      </div>
    )
  }

  if (!members.length) {
    return (
      <div className="rounded-2xl border border-carbon-200 dark:border-white/10 bg-white dark:bg-carbon-900 p-10 text-center text-carbon-400 font-bold italic">
        Sin resultados
      </div>
    )
  }

  return (
    <>
      {/* Mobile — lista compacta con bottom sheet */}
      <div className="md:hidden space-y-2">
        {members.map((m) => (
          <MobileCard
            key={m.user_id}
            m={m}
            onTap={() => setSheetMember(m)}
          />
        ))}
      </div>

      {/* Desktop — grid de cards */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {members.map((m, idx) => (
          <DesktopCard
            key={m.user_id}
            m={m}
            idx={idx}
            onEdit={onEdit}
            onDelete={onDelete}
            onQuickRenew={onQuickRenew}
          />
        ))}
      </div>

      {/* Bottom sheet — solo mobile */}
      <ActionSheet
        open={!!sheetMember}
        member={sheetMember}
        onClose={() => setSheetMember(null)}
        onEdit={onEdit}
        onDelete={onDelete}
        onQuickRenew={onQuickRenew}
      />
    </>
  )
}