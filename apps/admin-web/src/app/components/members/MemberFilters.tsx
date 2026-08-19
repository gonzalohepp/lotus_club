'use client'

import StyledSelect from '../common/StyledSelect'

type Filters = {
  status: 'todos' | 'activo' | 'vencido'
  className: 'todas' | string
  role: 'todos' | 'admin' | 'member' | 'instructor' | 'becado'
}

type ClassOpt = { id: number; name: string }

const triggerClass = 'h-9 md:h-10 rounded-xl px-3 md:px-4 text-[11px] md:text-xs font-bold uppercase tracking-wider'

export default function MemberFilters({
  value,
  onChange,
  classes,
}: {
  value: Filters
  onChange: (v: Filters) => void
  classes: ClassOpt[]
}) {
  return (
    <>
      <StyledSelect
        wrapperClassName="shrink-0"
        triggerClassName={triggerClass}
        value={value.status}
        onChange={(v) => onChange({ ...value, status: v as Filters['status'] })}
        options={[
          { value: 'todos', label: 'Todos los Estados' },
          { value: 'activo', label: 'Activos' },
          { value: 'vencido', label: 'Vencidos' },
        ]}
      />

      <StyledSelect
        wrapperClassName="shrink-0"
        triggerClassName={triggerClass}
        value={value.className}
        onChange={(v) => onChange({ ...value, className: v })}
        options={[
          { value: 'todas', label: 'Todas las Clases' },
          ...classes.map((c) => ({ value: c.name, label: c.name })),
        ]}
      />

      <StyledSelect
        wrapperClassName="shrink-0"
        triggerClassName={triggerClass}
        value={value.role}
        onChange={(v) => onChange({ ...value, role: v as Filters['role'] })}
        options={[
          { value: 'todos', label: 'Todos los Roles' },
          { value: 'member', label: 'Alumnos' },
          { value: 'instructor', label: 'Instructores' },
          { value: 'becado', label: 'Becados' },
          { value: 'admin', label: 'Administrador' },
        ]}
      />
    </>
  )
}
