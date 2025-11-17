'use client'

type Filters = {
  status: 'todos' | 'activo' | 'inactivo'
  membership: 'todos' | 'monthly' | 'quarterly' | 'semiannual' | 'annual'
  className: 'todas' | string
}

type ClassOpt = { id: number; name: string }

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
    <div className="mb-6 flex flex-wrap gap-3">
      {/* Estado */}
      <select
        className="h-10 rounded-lg border border-slate-300 bg-white px-3"
        value={value.status}
        onChange={(e) => onChange({ ...value, status: e.target.value as Filters['status'] })}
      >
        <option value="todos">Todos los Estados</option>
        <option value="activo">Activos</option>
        <option value="inactivo">Vencidos</option>
      </select>

      {/* Membresía */}
      <select
        className="h-10 rounded-lg border border-slate-300 bg-white px-3"
        value={value.membership}
        onChange={(e) => onChange({ ...value, membership: e.target.value as Filters['membership'] })}
      >
        <option value="todos">Todas las Membresías</option>
        <option value="monthly">Mensual</option>
        <option value="quarterly">Trimestral</option>
        <option value="semiannual">Semestral</option>
        <option value="annual">Anual</option>
      </select>

      {/* Clase (dinámico) */}
      <select
        className="h-10 rounded-lg border border-slate-300 bg-white px-3"
        value={value.className}
        onChange={(e) => onChange({ ...value, className: e.target.value as Filters['className'] })}
      >
        <option value="todas">Todas las Clases</option>
        {classes.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
