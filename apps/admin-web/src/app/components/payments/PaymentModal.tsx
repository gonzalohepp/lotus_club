'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { X, Save } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type MemberOpt = { user_id: string; name: string };

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
  const [loading, setLoading] = useState(false);

  // form
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<'efectivo' | 'transferencia' | 'mercadopago'>('efectivo');
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [from, setFrom] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [to, setTo] = useState<string>(() => {
    const dt = new Date();
    dt.setMonth(dt.getMonth() + 1);
    return dt.toISOString().slice(0,10);
  });
  const [notes, setNotes] = useState('');

  // carga options de miembros
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .order('last_name', { ascending: true, nullsFirst: true });

      if (error) {
        console.error('Error cargando miembros:', error);
        setMembers([]);
      } else {
        const opts = (data ?? []).map((p: any) => ({
          user_id: p.user_id,
          name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim(),
        }));
        setMembers(opts);
      }
    })();
  }, [open]);

  const canSave = useMemo(
    () => !!userId && !!amount && !!paidAt && !!from && !!to,
    [userId, amount, paidAt, from, to]
  );

  const reset = () => {
    setUserId('');
    setAmount('');
    setMethod('efectivo');
    const today = new Date().toISOString().slice(0,10);
    setPaidAt(today);
    setFrom(today);
    const dt = new Date();
    dt.setMonth(dt.getMonth() + 1);
    setTo(dt.toISOString().slice(0,10));
    setNotes('');
  };

  const save = async () => {
    if (!canSave) return;
    setLoading(true);

    // 1) Insert en payments
    const { data: insertPay, error: payErr } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount,
        method,
        paid_at: paidAt,
        period_from: from,
        period_to: to,
        notes: notes || null,
      })
      .select('id')
      .maybeSingle();

    if (payErr) {
      alert('Error registrando pago: ' + payErr.message);
      setLoading(false);
      return;
    }

    // 2) Insert en memberships (para actualizar vencimiento en la vista)
    const { error: membErr } = await supabase.from('memberships').insert({
      member_id: userId,
      type: 'monthly',         // si usás otros tipos, podés inferir según tu UI
      start_date: from,
      end_date: to,
      notes: `Pago ${insertPay?.id ?? ''}`.trim(),
    });

    if (membErr) {
      // No detengo el flujo: el pago quedó registrado
      console.warn('Pago creado pero falló actualizar membresía:', membErr.message);
    }

    setLoading(false);
    reset();
    onSaved();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-xl font-semibold text-slate-900">Registrar Pago</h3>
          <button
            onClick={() => { reset(); onClose(); }}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Miembro *</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={userId}
              onChange={e => setUserId(e.target.value)}
            >
              <option value="">Seleccionar miembro</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">Monto *</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="40000"
              value={amount}
              onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
              min={0}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">Fecha de Pago *</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={paidAt}
              onChange={e => setPaidAt(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">Método de Pago</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={method}
              onChange={e => setMethod(e.target.value as any)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">Período Desde *</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">Período Hasta *</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">Notas</label>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Descripción u observaciones…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
            onClick={() => { reset(); onClose(); }}
          >
            Cancelar
          </button>
          <button
            disabled={!canSave || loading}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Guardando…' : 'Registrar Pago'}
          </button>
        </div>
      </div>
    </div>
  );
}
