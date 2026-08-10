'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/lib/tenant/context';
import { NO_DOJO } from '@/lib/tenant/constants'
import AdminLayout from '../layouts/AdminLayout';
import { Plus, Download, Check, Receipt, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

import PaymentFilters from '../components/payments/PaymentFilters';
import PaymentModal from '../components/payments/PaymentModal';
import { fmtARS, fmtDateShort } from '@/lib/format';

const fmtDate = fmtDateShort;

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

type PaymentFromDB = {
  id: number;
  user_id: string;
  amount: number;
  method: string;
  paid_at: string | null;
  payment_date?: string | null;
  created_at?: string | null;
  period_from: string | null;
  period_to: string | null;
  notes: string | null;
  profiles: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
};

type ClassFromDB = {
  id: number;
  name: string;
};

const ITEMS_PER_PAGE = 5;

export default function PaymentsPage() {
  // Los pagos son de una sede. RLS habilita todas las que administrás; el
  // filtro decide cuál estás mirando.
  const { activeDojo, allows } = useTenant();
  const dojoId = activeDojo?.id;

  // Cobrar es del administrador de la sede. El Mestre ve toda la recaudación de
  // la marca pero no registra pagos; al Coordinador regional no le llega ni la
  // sección. Reforzado en la base por `can_manage_payments()`.
  const canCharge = allows('managePayments');

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // filtros
  const [memberOpts, setMemberOpts] = useState<{ value: string; label: string }[]>([]);
  const [classOpts, setClassOpts] = useState<{ value: string; label: string }[]>([]);
  const [months, setMonths] = useState<{ value: string; label: string }[]>([]);
  const [filters, setFilters] = useState({ member: 'all', classId: 'all', month: 'all' });

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

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

  const load = useCallback(async () => {
    setLoading(true);

    const { data: pays, error: payErr } = await supabase
      .from('payments')
      .select('id,user_id,amount,method,paid_at,period_from,period_to,notes, profiles(first_name, last_name)')
      .eq('dojo_id', dojoId ?? NO_DOJO)
      .order('paid_at', { ascending: false });

    if (payErr) {
      console.error('Error cargando pagos:', payErr);
      setRows([]);
      setLoading(false);
      return;
    }

    const nameMap: Record<string, string> = {};
    const mapped: PaymentRow[] = (pays ?? []).map((r: PaymentFromDB) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || '—';
      if (r.user_id) nameMap[r.user_id] = name;
      return {
        id: r.id,
        user_id: r.user_id,
        amount: Number(r.amount),
        method: r.method,
        paid_at: r.paid_at ?? r.payment_date ?? r.created_at ?? null,
        period_from: r.period_from,
        period_to: r.period_to,
        notes: r.notes ?? null,
        member_name: name,
      };
    });
    setRows(mapped);

    setMemberOpts(
      Object.entries(nameMap)
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    );

    const { data: classes } = await supabase
      .from('classes')
      .select('id,name')
      .eq('dojo_id', dojoId ?? NO_DOJO)
      .order('name', { ascending: true });
    setClassOpts((classes ?? []).map((c: ClassFromDB) => ({ value: String(c.id), label: c.name })));

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
  }, [dojoId]);

  useEffect(() => {
    // `load` reusa código ya cubierto por otros call-sites (ver onSaved del modal);
    // no vale la pena duplicar sus ~60 líneas solo para este fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dojoId) return;
    load();
  }, [load, dojoId]);

  const filtered = useMemo(() => {
    const mk = (d: string | null) => monthKey(d);
    return rows.filter((r) => {
      const okMember = filters.member === 'all' || r.user_id === filters.member;
      const okMonth = filters.month === 'all' || mk(r.paid_at) === filters.month;
      const okClass = filters.classId === 'all' || true;
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
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-kuro-500/5 blur-[120px]" />
        <div className="absolute -right-[5%] bottom-[5%] h-[30%] w-[30%] rounded-full bg-kuro-500/5 blur-[100px]" />
      </div>

      <div className="relative">
        {/* Header Section */}
        <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center rounded-full bg-kuro-50 dark:bg-kuro-900/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-kuro-600 dark:text-kuro-400 ring-1 ring-inset ring-kuro-600/20 dark:ring-kuro-400/20">
                Finanzas
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-carbon-900 dark:text-white">
              Registro de <span className="text-kuro-600 dark:text-kuro-400">Pagos</span>
            </h1>
            <p className="max-w-md text-carbon-500 dark:text-carbon-400 font-medium italic">
              &quot;El orden financiero es el cimiento de la disciplina.&quot;
            </p>
          </motion.div>

          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onExport}
              className="group flex items-center gap-2 rounded-2xl border border-carbon-200 dark:border-carbon-700 bg-white dark:bg-carbon-800 px-6 py-4 text-sm font-black uppercase tracking-widest text-carbon-600 dark:text-carbon-300 shadow-sm transition-all hover:bg-carbon-50 dark:hover:bg-carbon-700 hover:border-carbon-300 dark:hover:border-carbon-600"
            >
              <Download className="h-5 w-5 text-carbon-400 group-hover:text-carbon-600 dark:group-hover:text-carbon-300 transition-colors" />
              Exportar
            </motion.button>

            {canCharge ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setOpen(true)}
                className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-kuro-600 px-6 py-3 text-white shadow-xl shadow-kuro-500/25 transition-all hover:bg-kuro-700 font-black uppercase tracking-widest text-sm"
              >
                <Plus className="h-6 w-6" />
                Registrar Pago
              </motion.button>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-carbon-200 bg-carbon-50 px-4 py-3 text-carbon-500 dark:border-carbon-700 dark:bg-carbon-800/60 dark:text-carbon-400">
                <Eye className="h-4 w-4 shrink-0" />
                <span className="text-xs font-bold">Sólo lectura · los pagos los registra cada sede</span>
              </div>
            )}
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
            onChange={handleFilterChange}
          />
        </motion.div>

        {/* Data Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="overflow-hidden rounded-2xl border border-carbon-200 dark:border-carbon-700 bg-white/80 dark:bg-carbon-800/80 backdrop-blur-xl shadow-2xl relative"
        >
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-carbon-900 dark:bg-carbon-950">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-carbon-400">Fecha</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-carbon-400">Miembro</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-carbon-400">Monto</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-carbon-400">Método de Pago</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-carbon-400">Período de Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-100 dark:divide-carbon-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-kuro-500/20 border-t-kuro-500" />
                        <p className="text-sm font-black uppercase tracking-widest text-carbon-400">Actualizando Libros...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-carbon-50 dark:bg-carbon-800 flex items-center justify-center text-carbon-300 dark:text-carbon-600">
                          <Receipt className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-black uppercase tracking-widest text-carbon-400">Sin movimientos registrados</p>
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
                      className="group transition-colors hover:bg-carbon-50/50 dark:hover:bg-carbon-700/50"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-carbon-100 dark:bg-carbon-700 flex items-center justify-center text-carbon-400 group-hover:bg-white dark:group-hover:bg-carbon-600 group-hover:text-kuro-500 dark:group-hover:text-kuro-400 transition-colors">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-carbon-900 dark:text-white">{fmtDate(row.paid_at)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-bold text-carbon-600 dark:text-dojo-300 group-hover:text-carbon-900 dark:group-hover:text-white transition-colors">{row.member_name}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-lg font-black text-kuro-600 dark:text-kuro-400">{fmtARS(row.amount)}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          {row.method === 'mercadopago' ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-kuro-500" />
                          ) : row.method === 'transferencia' ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-kuro-500" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-kuro-500" />
                          )}
                          <span className="text-[10px] font-black uppercase tracking-widest text-carbon-500 dark:text-carbon-400">{row.method}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-carbon-400 font-medium text-xs">
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
            <div className="flex items-center justify-between border-t border-carbon-100 dark:border-carbon-700 bg-carbon-50 dark:bg-carbon-900/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-kuro-500 animate-pulse" />
                <p className="text-xs font-bold text-carbon-400 uppercase tracking-widest">
                  Resultados: <span className="text-carbon-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> de <span className="text-carbon-900 dark:text-white">{totalItems}</span>
                </p>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 text-carbon-600 dark:text-carbon-400 hover:bg-carbon-50 dark:hover:bg-carbon-700 hover:border-carbon-300 dark:hover:border-carbon-600 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, i) => {
                      // Logic to show limited page numbers if there are too many
                      if (totalPages > 7) {
                        if (i + 1 !== 1 && i + 1 !== totalPages && Math.abs(i + 1 - currentPage) > 1) {
                          if (i + 1 === currentPage - 2 || i + 1 === currentPage + 2) return <span key={i} className="px-1 text-carbon-400">...</span>;
                          return null;
                        }
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === i + 1
                            ? 'bg-carbon-900 dark:bg-white text-white dark:text-carbon-900 shadow-lg'
                            : 'bg-white dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 text-carbon-500 dark:text-carbon-400 hover:border-carbon-400 dark:hover:border-carbon-500'
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
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-carbon-800 border border-carbon-200 dark:border-carbon-700 text-carbon-600 dark:text-carbon-400 hover:bg-carbon-50 dark:hover:bg-carbon-700 hover:border-carbon-300 dark:hover:border-carbon-600 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
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
            <div className="flex items-center gap-3 rounded-xl bg-carbon-900 px-6 py-3 text-white shadow-2xl">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kuro-500">
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
