'use client';

import { User, Layers, CalendarDays } from 'lucide-react';
import StyledSelect from '../common/StyledSelect';

type Opt = { value: string; label: string };
type Props = {
  members: Opt[];
  classes: Opt[];
  months: Opt[];
  value: { member: string; classId: string; month: string };
  onChange: (v: Props['value']) => void;
};

const triggerClass = 'h-14 rounded-2xl text-sm font-bold';

export default function PaymentFilters({ members, classes, months, value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <StyledSelect
        icon={User}
        triggerClassName={triggerClass}
        value={value.member}
        onChange={(v) => onChange({ ...value, member: v })}
        options={[{ value: 'all', label: 'Todos los Miembros' }, ...members]}
      />

      <StyledSelect
        icon={Layers}
        triggerClassName={triggerClass}
        value={value.classId}
        onChange={(v) => onChange({ ...value, classId: v })}
        options={[{ value: 'all', label: 'Todas las Clases' }, ...classes]}
      />

      <StyledSelect
        icon={CalendarDays}
        triggerClassName={triggerClass}
        value={value.month}
        onChange={(v) => onChange({ ...value, month: v })}
        options={[{ value: 'all', label: 'Todos los Meses' }, ...months]}
      />
    </div>
  );
}
