import { X, UserPlus, UserCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import MemberForm from './MemberForm'

import { MemberRow } from '@/types/member'

export default function MemberModal({
  open, onClose, member, onSubmit,
}: {
  open: boolean
  onClose: () => void
  member: MemberRow | null
  onSubmit: (payload: any) => Promise<void>
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl"
          >
            {/* Header Header */}
            <div className="relative h-32 bg-slate-900 flex items-center px-10 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="relative flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-blue-400 border border-white/10 group-hover:scale-110 transition-transform">
                  {member ? <UserCircle2 className="w-8 h-8" /> : <UserPlus className="w-8 h-8" />}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                    {member ? 'Editar Alumno' : 'Nuevo Alumno'}
                  </h2>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Panel de Registro</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar px-10 py-8">
              <MemberForm
                member={member}
                onCancel={onClose}
                onSubmit={async (data) => { await onSubmit(data); onClose() }}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
