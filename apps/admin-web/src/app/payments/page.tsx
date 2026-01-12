'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import AdminLayout from '../layouts/AdminLayout';
import { Plus, Download, Check, Receipt, CreditCard, ChevronLeft, ChevronRight, FileSpreadsheet, Search } from 'lucide-react';

import PaymentFilters from '../components/payments/PaymentFilters';
import PaymentModal from '../components/payments/PaymentModal';

// ===================== Helpers =====================
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

const ITEMS_PER_PAGE = 5;

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // filtros
  const [memberOpts, setMemberOpts] = useState<{ value: string; label: string }[]>([]);
  const [classOpts, setClassOpts] = useState<{ value: string; label: string }[]>([]);
  const [months, setMonths] = useState<{ value: string; label: string }[]>([]);
  const [filters, setFilters] = useState({ member: '', classId: '', month: '' });

  // modal
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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

    setMemberOpts(
      Object.entries(nameById)
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    );

    const { data: classes } = await supabase.from('classes').select('id,name').order('name', { ascending: true });
    setClassOpts((classes ?? []).map((c: any) => ({ value: String(c.id), label: c.name })));

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

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const mk = (d: string | null) => monthKey(d);
    return rows.filter((r) => {
      const okMember = !filters.member || r.user_id === filters.member;
      const okMonth = !filters.month || mk(r.paid_at) === filters.month;
      const okClass = !filters.classId || true;
      return okMember && okMonth && okClass;
    });
  }, [rows, filters]);

  // Pagination Logic
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

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

    const csv = header.join(';') + '\n' + lines.map((row) => row.map((c) => (typeof c === 'string' ? `"${c.replace(/"/g, '""')}"` : String(c))).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pagos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout active="/payments">
      {/* Background Decor */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute -right-[5%] bottom-[5%] h-[30%] w-[30%] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl p-6 md:p-8">
        {/* Header Section */}
        <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-400/20">
                Finanzas
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
              Registro de <span className="text-emerald-600 dark:text-emerald-400">Pagos</span>
            </h1>
            <p className="max-w-md text-slate-500 dark:text-slate-400 font-medium italic">
              "El orden financiero es el cimiento de la disciplina."
            </p>
          </motion.div>

          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onExport}
              className="group flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4 text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            >
              <Download className="h-5 w-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              Exportar
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setOpen(true)}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-emerald-600 px-8 py-4 text-white shadow-xl shadow-emerald-500/25 transition-all hover:bg-emerald-700 font-black uppercase tracking-widest text-sm"
            >
              <Plus className="h-6 w-6" />
              Registrar Pago
            </motion.button>
          </div>
        </header>

        {/* Filters Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <PaymentFilters
            members={memberOpts}
            classes={classOpts}
            months={months}
            value={filters}
            onChange={setFilters}
          />
        </motion.div>

        {/* Data Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="overflow-hidden rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-2xl relative"
        >
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-900 dark:bg-slate-950">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Miembro</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Monto</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Método de Pago</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Período de Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500/20 border-t-emerald-500" />
                        <p className="text-sm font-black uppercase tracking-widest text-slate-400">Actualizando Libros...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
                          <Receipt className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-black uppercase tracking-widest text-slate-400">Sin movimientos registrados</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((row, idx) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-700/50"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtDate(row.paid_at)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-bold text-slate-600 dark:text-dojo-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{row.member_name}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{fmtARS(row.amount)}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          {row.method === 'mercadopago' ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          ) : row.method === 'transferencia' ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          )}
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{row.method}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-400 font-medium text-xs">
                          <span>{fmtDate(row.period_from)}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span>{fmtDate(row.period_to)}</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Resultados: <span className="text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> de <span className="text-slate-900 dark:text-white">{totalItems}</span>
                </p>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, i) => {
                      // Logic to show limited page numbers if there are too many
                      if (totalPages > 7) {
                        if (i + 1 !== 1 && i + 1 !== totalPages && Math.abs(i + 1 - currentPage) > 1) {
                          if (i + 1 === currentPage - 2 || i + 1 === currentPage + 2) return <span key={i} className="px-1 text-slate-400">...</span>;
                          return null;
                        }
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === i + 1
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                            }`}
                        >
                          {i + 1}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      <PaymentModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
          load();
        }}
      />

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-10 left-1/2 z-[200] -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-white shadow-2xl">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
                <Check className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-black uppercase tracking-widest text-white">Pago Registrado</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
