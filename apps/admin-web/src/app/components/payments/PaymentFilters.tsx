'use client';

import { User, Layers, CalendarDays } from 'lucide-react';

type Opt = { value: string; label: string };
type Props = {
  members: Opt[];
  classes: Opt[];
  months: Opt[];
  value: { member: string; classId: string; month: string };
  onChange: (v: Props['value']) => void;
};

export default function PaymentFilters({ members, classes, months, value, onChange }: Props) {
  const selectClass = "h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm font-bold text-slate-700 outline-none ring-blue-500/10 transition-all focus:border-blue-500/50 focus:ring-4 cursor-pointer";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Member Filter */}
      <div className="relative group">
        <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors" />
        <select
          value={value.member}
          onChange={(e) => onChange({ ...value, member: e.target.value })}
          className={selectClass}
        >
          <option value="">Todos los Miembros</option>
          {members.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
          <svg className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {/* Class Filter */}
      <div className="relative group">
        <Layers className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors" />
        <select
          value={value.classId}
          onChange={(e) => onChange({ ...value, classId: e.target.value })}
          className={selectClass}
        >
          <option value="">Todas las Clases</option>
          {classes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
          <svg className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {/* Month Filter */}
      <div className="relative group">
        <CalendarDays className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors" />
        <select
          value={value.month}
          onChange={(e) => onChange({ ...value, month: e.target.value })}
          className={selectClass}
        >
          <option value="">Todos los Meses</option>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
          <svg className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  );
}
