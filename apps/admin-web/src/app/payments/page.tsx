'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import AdminLayout from '../layouts/AdminLayout';
import { Plus, Download, Check } from 'lucide-react';

import PaymentFilters from '../components/payments/PaymentFilters';
import PaymentModal from '../components/payments/PaymentModal';

// ===================== Overlay de éxito (reutilizable) =====================
function CenterSuccessOverlay({
  message,
  onClose,
  showIcon = true,
}: {
  message: string;
  onClose: () => void;
  showIcon?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t1 = setTimeout(() => setVisible(true), 10);      // fade in
    const t2 = setTimeout(() => setVisible(false), 1800);   // fade out
    const t3 = setTimeout(onClose, 2000);                   // desmontar
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onClose]);

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
  );

  return mounted ? createPortal(node, document.body) : null;
}

// ===================== helpers =====================
const fmtARS = (v: number) =>
  v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const fmtDate = (v?: string | Date | null) => {
  if (!v) return '—';
  if (typeof v === 'string') {
    const iso = v.includes('T') ? v : `${v}T00:00:00`;
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const d = new Date(v);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
};

type PaymentRow = {
  id: number;
  user_id: string;
  member_name: string;
  amount: number;
  method: string;
  paid_at: string | null;
  period_from: string | null;
  period_to: string | null;
  notes: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ===================== page =====================
export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [memberOpts, setMemberOpts] = useState<{ value: string; label: string }[]>([]);
  const [classOpts, setClassOpts] = useState<{ value: string; label: string }[]>([]);
  const [months, setMonths] = useState<{ value: string; label: string }[]>([]);
  const [filters, setFilters] = useState({ member: '', classId: '', month: '' });

  // modal
  const [open, setOpen] = useState(false);

  // overlay éxito
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const monthKey = (d: string | null) => {
    if (!d) return '';
    const iso = d.includes('T') ? d : `${d}T00:00:00`;
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const load = async () => {
    setLoading(true);

    // pagos
    const { data: pays, error: payErr } = await supabase
      .from('payments')
      .select('id,user_id,amount,method,paid_at,period_from,period_to,notes')
      .order('paid_at', { ascending: false });

    if (payErr) {
      console.error('Error cargando pagos:', payErr);
      setRows([]);
      setLoading(false);
      return;
    }

    // perfiles (para nombres)
    const ids = Array.from(new Set((pays ?? []).map((p: any) => p.user_id)));
    const nameById: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', ids);

      (profs ?? []).forEach((p: any) => {
        nameById[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
      });
    }

    const mapped: PaymentRow[] = (pays ?? []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      amount: Number(r.amount),
      method: r.method,
      paid_at: r.paid_at ?? r.payment_date ?? r.created_at ?? null,
      period_from: r.period_from,
      period_to: r.period_to,
      notes: r.notes ?? null,
      member_name: nameById[r.user_id] || '—',
    }));
    setRows(mapped);

    // opciones de miembros
    setMemberOpts(
      Object.entries(nameById)
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    );

    // opciones de clases
    const { data: classes } = await supabase.from('classes').select('id,name').order('name', { ascending: true });
    setClassOpts((classes ?? []).map((c: any) => ({ value: String(c.id), label: c.name })));

    // meses disponibles (por paid_at)
    const monthMap: Record<string, string> = {};
    mapped.forEach((r) => {
      const mk = monthKey(r.paid_at);
      if (mk) {
        const [y, m] = mk.split('-');
        const date = new Date(Number(y), Number(m) - 1, 1);
        monthMap[mk] = date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
      }
    });
    setMonths(
      Object.keys(monthMap)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => ({ value: k, label: monthMap[k] }))
        .reverse()
    );

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // filtrado
  const filtered = useMemo(() => {
    const mk = (d: string | null) => monthKey(d);
    return rows.filter((r) => {
      const okMember = !filters.member || r.user_id === filters.member;
      const okMonth = !filters.month || mk(r.paid_at) === filters.month;

      // por ahora, filtro de clase “abierto” (si querés precisión, cruzamos con class_enrollments)
      const okClass = !filters.classId || true;

      return okMember && okMonth && okClass;
    });
  }, [rows, filters]);

  // export CSV (según lo filtrado)
  const onExport = () => {
    const header = ['Fecha', 'Miembro', 'Monto', 'Método', 'Periodo Desde', 'Periodo Hasta', 'Notas'];
    const lines = filtered.map((r) => [
      fmtDate(r.paid_at),
      r.member_name,
      r.amount,
      r.method,
      fmtDate(r.period_from),
      fmtDate(r.period_to),
      (r.notes ?? '').replace(/\r?\n/g, ' '),
    ]);

    const csv =
      header.join(';') +
      '\n' +
      lines.map((row) => row.map((c) => (typeof c === 'string' ? `"${c.replace(/"/g, '""')}"` : String(c))).join(';')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pagos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      {/* Header (sin total) */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Registro de Pagos</h1>
          <p className="text-slate-600">Historial completo de cuotas</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
            title="Exportar CSV"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>

          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
            title="Registrar Pago"
          >
            <Plus className="h-5 w-5" />
            Registrar Pago
          </button>
        </div>
      </div>

      {/* Filtros */}
      <PaymentFilters
        members={memberOpts}
        classes={classOpts}
        months={months}
        value={filters}
        onChange={setFilters}
      />

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full table-auto">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Miembro</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3">Período</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-slate-400" colSpan={5}>
                  Cargando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-400" colSpan={5}>
                  Sin resultados
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{fmtDate(row.paid_at)}</td>
                  <td className="px-4 py-3">{row.member_name}</td>
                  <td className="px-4 py-3 font-medium text-green-700">{fmtARS(row.amount)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs text-green-700">
                      {row.method}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {fmtDate(row.period_from)} - {fmtDate(row.period_to)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal registrar pago */}
      <PaymentModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          setSuccessMsg('Pago registrado exitosamente'); // 👈 Overlay
          load();
        }}
      />

      {successMsg && (
        <CenterSuccessOverlay
          message={successMsg}
          onClose={() => setSuccessMsg(null)}
        />
      )}
    </AdminLayout>
  );
}
