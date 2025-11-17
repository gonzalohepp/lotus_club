'use client';

type Opt = { value: string; label: string };
type Props = {
  members: Opt[];    // [{value:user_id, label:'Nombre'}]
  classes: Opt[];    // [{value:class_id, label:'Nombre de clase'}]
  months: Opt[];     // [{value:'2025-10', label:'oct 2025'}]
  value: { member: string; classId: string; month: string };
  onChange: (v: Props['value']) => void;
};

export default function PaymentFilters({ members, classes, months, value, onChange }: Props) {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <select
        className="h-10 rounded-lg border border-slate-300 bg-white px-3"
        value={value.member}
        onChange={(e)=>onChange({...value, member: e.target.value})}
      >
        <option value="">Todos los Miembros</option>
        {members.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>

      <select
        className="h-10 rounded-lg border border-slate-300 bg-white px-3"
        value={value.classId}
        onChange={(e)=>onChange({...value, classId: e.target.value})}
      >
        <option value="">Todas las Clases</option>
        {classes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      <select
        className="h-10 rounded-lg border border-slate-300 bg-white px-3"
        value={value.month}
        onChange={(e)=>onChange({...value, month: e.target.value})}
      >
        <option value="">Todos los Meses</option>
        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </div>
  );
}
