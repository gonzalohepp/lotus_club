'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Plus, Check, DollarSign, Loader2, User, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { lastDayOfMonth, addMonths } from 'date-fns';
import { getPaymentMultiplier } from '@/lib/pricing';
import { mercadoPagoEnabled } from '@/lib/features';
import StyledSelect from '../common/StyledSelect';

type MemberOpt = {
  user_id: string;
  name: string;
  is_new_member: boolean;
  next_payment_due: string | null;
  role: string | null;
};

type ClassOption = {
  id: number
  name: string
  price_principal: number
  price_additional: number
}

export default function PaymentModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [userId, setUserId] = useState('');

  // Class Selections
  const [principalClass, setPrincipalClass] = useState<number | null>(null)
  const [additionalClasses, setAdditionalClasses] = useState<number[]>([])

  // Payment Config
  const [method, setMethod] = useState<'efectivo' | 'transferencia' | 'mercadopago'>('efectivo');

  const [loading, setLoading] = useState(false);
  const [fetchingClasses, setFetchingClasses] = useState(false);

  // Initial Data Fetch
  useEffect(() => {
    if (!open) return;

    (async () => {
      // Load classes
      const { data: classData } = await supabase.from('classes').select('*').order('name')
      if (classData) setClasses(classData)

      // Load members
      const { data, error } = await supabase
        .from('members_with_status')
        .select('user_id, first_name, last_name, is_new_member, next_payment_due, role')
        .order('last_name', { ascending: true, nullsFirst: true });

      if (error) console.error('[PaymentModal] load members error:', error)

      if (data) {
        const opts: MemberOpt[] = data.map(p => ({
          user_id: p.user_id,
          name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim(),
          is_new_member: p.is_new_member,
          next_payment_due: p.next_payment_due || null,
          role: p.role || null,
        }));
        setMembers(opts);
      }
    })();
  }, [open]);

  // When User Selected -> Load Current Enrollments
  useEffect(() => {
    if (!userId) {
      // Reset de selección al deseleccionar el alumno.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrincipalClass(null)
      setAdditionalClasses([])
      return
    }
    setFetchingClasses(true);
    (async () => {
      const { data } = await supabase
        .from('class_enrollments')
        .select('class_id, is_principal')
        .eq('user_id', userId)

      if (data) {
        const p = data.find(d => d.is_principal)
        const a = data.filter(d => !d.is_principal).map(d => d.class_id)
        setPrincipalClass(p?.class_id || null)
        setAdditionalClasses(a)
      }
      setFetchingClasses(false);
    })()
  }, [userId])


  // Logic Helpers
  const handlePrincipalChange = (id: number) => {
    setPrincipalClass(id)
    setAdditionalClasses(prev => prev.filter(c => c !== id))
  }

  const toggleAdditional = (id: number) => {
    if (id === principalClass) return
    setAdditionalClasses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  // Pricing Logic
  const selectedMember = useMemo(() => members.find(m => m.user_id === userId), [members, userId]);

  const multiplier = useMemo(() => {
    return getPaymentMultiplier(
      selectedMember?.next_payment_due ?? null,
      selectedMember?.is_new_member ?? false,
      selectedMember?.role
    )
  }, [selectedMember])

  const total = useMemo(() => {
    let sum = 0
    if (principalClass) {
      const p = classes.find(c => c.id === principalClass)
      sum += Number(p?.price_principal || 0)
    }
    additionalClasses.forEach(id => {
      const a = classes.find(c => c.id === id)
      sum += Number(a?.price_additional || a?.price_principal || 0)
    })
    return sum * multiplier
  }, [principalClass, additionalClasses, classes, multiplier])

  const fmt = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

  // SAVE Action
  const handleSave = async () => {
    if (!userId || !principalClass) return;
    setLoading(true);

    // 1. Calculate Period (Strictly month-to-month)
    const today = new Date();
    const months = 1;
    const toDate = lastDayOfMonth(addMonths(today, months - 1));
    const fromStr = today.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);
    const day = today.getDate();

    // 2. Update Enrollments
    await supabase.from('class_enrollments').delete().eq('user_id', userId)
    const newEnrollments: { user_id: string, class_id: number, is_principal: boolean }[] = []
    if (principalClass) newEnrollments.push({ user_id: userId, class_id: principalClass, is_principal: true })
    additionalClasses.forEach(id => newEnrollments.push({ user_id: userId, class_id: id, is_principal: false }))
    if (newEnrollments.length > 0) {
      await supabase.from('class_enrollments').insert(newEnrollments)
    }

    // 3. Insert Payment
    const note = multiplier > 1 ? `Incluye recargo del 20% (día ${day}).` : null;

    const { data: insertPay, error: payErr } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount: total,
        method: method,
        paid_at: fromStr,
        period_from: fromStr,
        period_to: toStr,
        notes: note,
      })
      .select('id')
      .maybeSingle();

    if (payErr) {
      alert('Error al guardar pago: ' + payErr.message)
      setLoading(false)
      return
    }

    // 4. Update Membership Status
    // Fetch existing to preserve start_date (Join Date) if it exists
    const { data: existingMem } = await supabase
      .from('memberships')
      .select('start_date')
      .eq('member_id', userId)
      .maybeSingle();

    const finalStartDate = existingMem?.start_date || fromStr;

    await supabase.from('memberships').upsert({
      member_id: userId,
      type: 'monthly',
      start_date: finalStartDate,
      last_payment_date: fromStr, // New field for renewal logic
      end_date: toStr,
      notes: `Pago #${insertPay?.id}`,
    }, { onConflict: 'member_id' });

    setLoading(false);
    onClose();
    onSaved();
  }


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
            className="relative w-full max-w-4xl overflow-hidden rounded-[32px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[95vh]"
          >
            {/* Header */}
            <div className="relative h-24 bg-slate-900 flex items-center px-8 shrink-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight uppercase">Registrar Cobro</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Gestión Financiera</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="absolute top-8 right-8 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Top Bar: User Selection */}
            <div className="px-8 pt-8 pb-4 bg-white dark:bg-slate-900 z-10">
              <div className="relative">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">
                  Seleccionar Alumno
                </label>
                <StyledSelect
                  icon={User}
                  placeholder="Seleccionar miembro..."
                  triggerClassName="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 text-lg font-bold focus-visible:ring-emerald-500/10 focus-visible:border-emerald-500/50"
                  value={userId}
                  onChange={setUserId}
                  options={members.map(m => ({ value: m.user_id, label: m.name }))}
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
              {!userId ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-3xl mt-4">
                  <User className="w-12 h-12 mb-4 opacity-50" />
                  <p className="font-medium">Selecciona un alumno para ver sus clases</p>
                </div>
              ) : fetchingClasses ? (
                <div className="space-y-4 py-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  {/* Principal */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clase Principal</p>
                    </div>
                    <div className="space-y-3">
                      {classes.map(c => (
                        <label
                          key={`p-${c.id}`}
                          className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${principalClass === c.id
                            ? 'bg-blue-600 border-blue-600 shadow-xl shadow-blue-500/20'
                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-500/50'
                            }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${principalClass === c.id ? 'bg-white border-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 group-hover:border-blue-300'
                            }`}>
                            {principalClass === c.id && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                          </div>
                          <input
                            type="radio"
                            name="principal"
                            className="hidden"
                            checked={principalClass === c.id}
                            onChange={() => handlePrincipalChange(c.id)}
                          />
                          <div className="flex-1">
                            <p className={`text-sm font-bold leading-none ${principalClass === c.id ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{c.name}</p>
                            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${principalClass === c.id ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                              {fmt(c.price_principal)}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Additional */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Plus className="w-4 h-4 text-emerald-500" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clases Adicionales</p>
                    </div>
                    <div className="space-y-3">
                      {classes.map(c => {
                        const isSelected = additionalClasses.includes(c.id)
                        const isPrincipal = principalClass === c.id
                        return (
                          <label
                            key={`a-${c.id}`}
                            className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10'
                              : isPrincipal
                                ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50 border-transparent'
                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-500/50'
                              }`}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                              }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[4]" />}
                            </div>
                            <input
                              type="checkbox"
                              className="hidden"
                              disabled={isPrincipal}
                              checked={isSelected}
                              onChange={() => toggleAdditional(c.id)}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{c.name}</p>
                              <p className="text-[10px] font-black uppercase tracking-widest mt-1 text-emerald-600 dark:text-emerald-400">
                                + {fmt(c.price_additional || c.price_principal)}
                              </p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="bg-slate-950 p-6 md:px-8 md:py-6 shrink-0 relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center gap-6">
                {/* Row 1: Totals */}
                <div className="w-full flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Monto a Cobrar</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl md:text-5xl font-black text-white tracking-tight">{fmt(total)}</span>
                      <span className="text-xs font-bold text-slate-500 uppercase">ARS</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full animate-pulse ${selectedMember?.is_new_member ? 'bg-blue-400' : multiplier > 1 ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${selectedMember?.is_new_member ? 'text-blue-400' : multiplier > 1 ? 'text-orange-500' : 'text-emerald-500'}`}>
                        {selectedMember?.is_new_member ? '✨ Precio Flat (Nuevo)' : multiplier > 1 ? 'Incluye 20% Recargo' : 'Precio Estándar'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Payment Method & Action */}
                <div className="w-full flex flex-col md:flex-row gap-4 h-14">
                  <StyledSelect
                    wrapperClassName="flex-1 h-full"
                    icon={CreditCard}
                    value={method}
                    onChange={(v) => setMethod(v as 'efectivo' | 'transferencia' | 'mercadopago')}
                    triggerClassName="h-full bg-white/5 dark:bg-white/5 border-white/10 dark:border-white/10 text-white dark:text-white font-bold hover:bg-white/10 dark:hover:bg-white/10 focus-visible:ring-emerald-500/50"
                    contentClassName="bg-slate-900 dark:bg-slate-900 border-white/10 dark:border-white/10"
                    itemClassName="text-white dark:text-white focus:bg-white/10 dark:focus:bg-white/10"
                    options={[
                      { value: 'efectivo', label: 'Efectivo 💵' },
                      { value: 'transferencia', label: 'Transferencia 🏦' },
                      // Mercado Pago solo aparece si el cobro online está prendido
                      // en la instancia (NEXT_PUBLIC_MERCADOPAGO=on).
                      ...(mercadoPagoEnabled() ? [{ value: 'mercadopago', label: 'Mercado Pago 📱' }] : []),
                    ]}
                  />

                  <button
                    disabled={!userId || !principalClass || loading}
                    onClick={handleSave}
                    className="h-full px-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 min-w-[200px]"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Confirmar Pago</span>}
                  </button>
                </div>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
