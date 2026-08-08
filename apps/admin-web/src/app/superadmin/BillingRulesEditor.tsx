'use client'

import { Plus, Trash2 } from 'lucide-react'

import { describeBilling, evaluateBilling } from '@/lib/billing'
import type { BillingConfig, BillingTier } from '@/lib/tenant/types'

/**
 * BillingRulesEditor — Editor visual de la política de cobro de un dojo.
 *
 * Traduce a una tabla lo que antes era código: "del 1 al 10 sin recargo, del 11
 * al 19 con 20%, del 20 en adelante bloqueado". El dueño de cada sede arma sus
 * propios tramos y ve al instante cómo queda.
 *
 * El simulador de abajo corre el MISMO motor que usa el sistema en producción
 * (`evaluateBilling`), así que lo que se ve acá es literalmente lo que va a
 * pasar cuando un alumno pase el QR.
 */
export default function BillingRulesEditor({
    value,
    onChange,
}: {
    value: BillingConfig
    onChange: (next: BillingConfig) => void
}) {
    const tiers = [...value.tiers].sort((a, b) => a.from_day - b.from_day)

    const patchTier = (index: number, patch: Partial<BillingTier>) => {
        const next = [...tiers]
        next[index] = { ...next[index], ...patch }
        onChange({ ...value, tiers: next })
    }

    const addTier = () => {
        const last = tiers[tiers.length - 1]
        const from = last ? Math.min((last.to_day ?? last.from_day) + 1, 28) : 1
        onChange({
            ...value,
            tiers: [
                ...tiers,
                { from_day: from, to_day: null, surcharge_pct: 0, blocks_access: false, label: 'Nuevo tramo' },
            ],
        })
    }

    const removeTier = (index: number) => {
        onChange({ ...value, tiers: tiers.filter((_, i) => i !== index) })
    }

    // Huecos y solapamientos: no son errores fatales (el motor cae a "sin
    // recargo" si un día no está cubierto), pero casi siempre son un descuido.
    const warnings = validateTiers(tiers)

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-carbon-400 mb-1">
                    Tramos por día del mes
                </h3>
                <p className="text-xs text-carbon-500 mb-4">
                    Se evalúan contra el día de hoy, una vez que la cuota venció. El alumno que paga antes del
                    vencimiento nunca entra acá.
                </p>

                <div className="space-y-2">
                    {tiers.map((tier, i) => (
                        <div
                            key={i}
                            className="grid grid-cols-[1fr_auto] md:grid-cols-[80px_80px_1fr_100px_auto_auto] gap-2 items-center p-3 rounded-xl bg-carbon-50 dark:bg-carbon-800/50 border border-carbon-200 dark:border-carbon-700"
                        >
                            <NumberField
                                label="Desde día"
                                value={tier.from_day}
                                min={1}
                                max={31}
                                onChange={(v) => patchTier(i, { from_day: v ?? 1 })}
                            />

                            <NumberField
                                label="Hasta día"
                                value={tier.to_day}
                                min={1}
                                max={31}
                                nullable
                                placeholder="fin"
                                onChange={(v) => patchTier(i, { to_day: v })}
                            />

                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-carbon-400 mb-1">
                                    Etiqueta
                                </label>
                                <input
                                    type="text"
                                    value={tier.label}
                                    onChange={(e) => patchTier(i, { label: e.target.value })}
                                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-carbon-900 border border-carbon-200 dark:border-carbon-700 text-sm"
                                />
                            </div>

                            <NumberField
                                label="Recargo %"
                                value={tier.surcharge_pct}
                                min={0}
                                max={500}
                                onChange={(v) => patchTier(i, { surcharge_pct: v ?? 0 })}
                            />

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-carbon-400 mb-1">
                                    Bloquea
                                </label>
                                <button
                                    type="button"
                                    onClick={() => patchTier(i, { blocks_access: !tier.blocks_access })}
                                    className={`h-9 px-3 rounded-lg text-xs font-bold transition-colors ${
                                        tier.blocks_access
                                            ? 'bg-alert-500 text-white'
                                            : 'bg-carbon-200 dark:bg-carbon-700 text-carbon-500'
                                    }`}
                                    title="Si está activo, el QR rechaza el ingreso en este tramo"
                                >
                                    {tier.blocks_access ? 'Sí' : 'No'}
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => removeTier(i)}
                                className="p-2 rounded-lg text-carbon-400 hover:text-alert-500 hover:bg-alert-50 dark:hover:bg-alert-900/20 self-end"
                                aria-label="Eliminar tramo"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={addTier}
                    className="mt-3 flex items-center gap-2 px-4 h-10 rounded-xl border border-dashed border-carbon-300 dark:border-carbon-600 text-sm font-bold text-carbon-500 hover:border-kuro-500 hover:text-kuro-500 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Agregar tramo
                </button>

                {warnings.length > 0 && (
                    <ul className="mt-3 space-y-1">
                        {warnings.map((w, i) => (
                            <li key={i} className="text-xs text-warn-600 dark:text-warn-400">
                                ⚠ {w}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Reglas globales del dojo -------------------------------------- */}
            <div className="grid md:grid-cols-3 gap-4">
                <NumberField
                    label="Día de vencimiento"
                    value={value.due_day}
                    min={1}
                    max={31}
                    hint="Sólo informativo, para los textos que ve el alumno"
                    onChange={(v) => onChange({ ...value, due_day: v ?? 10 })}
                    block
                />
                <NumberField
                    label="Meses de atraso que bloquean"
                    value={value.months_overdue_blocks}
                    min={1}
                    max={12}
                    hint="Pasado ese atraso se bloquea sin importar el día"
                    onChange={(v) => onChange({ ...value, months_overdue_blocks: v ?? 2 })}
                    block
                />
                <NumberField
                    label="Redondeo del importe"
                    value={value.rounding}
                    min={0}
                    max={1000}
                    hint="0 = sin redondeo. 10 = redondear a $10"
                    onChange={(v) => onChange({ ...value, rounding: v ?? 0 })}
                    block
                />
            </div>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-carbon-50 dark:bg-carbon-800/50 cursor-pointer">
                <input
                    type="checkbox"
                    checked={value.new_member_exempt}
                    onChange={(e) => onChange({ ...value, new_member_exempt: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded"
                />
                <span className="text-sm">
                    <span className="font-bold">Alumnos nuevos sin recargo</span>
                    <span className="block text-xs text-carbon-500">
                        Quien todavía no registró ningún pago en esta sede no arrastra mora
                    </span>
                </span>
            </label>

            {/* Vista previa + simulador -------------------------------------- */}
            <div className="p-4 rounded-2xl bg-carbon-900 dark:bg-black text-carbon-200">
                <h4 className="text-xs font-black uppercase tracking-widest text-carbon-500 mb-3">
                    Así queda tu política
                </h4>
                <ul className="space-y-1 mb-5">
                    {describeBilling(value).map((line, i) => (
                        <li key={i} className="text-sm font-mono">
                            · {line}
                        </li>
                    ))}
                </ul>

                <h4 className="text-xs font-black uppercase tracking-widest text-carbon-500 mb-3">
                    Simulación — alumno que venció el mes pasado
                </h4>
                <Simulator config={value} />
            </div>
        </div>
    )
}

/**
 * Corre el motor real para cada día del mes y muestra qué pasaría. Es la forma
 * más honesta de validar la config: si acá se ve mal, en producción va a estar mal.
 */
function Simulator({ config }: { config: BillingConfig }) {
    const base = 10000
    const days = [1, 5, 10, 11, 15, 19, 20, 25, 28]

    // Vencimiento: fin del mes pasado respecto de un mes de referencia fijo,
    // para que la simulación no cambie según cuándo se abre la pantalla.
    const year = new Date().getFullYear()
    const dueDate = new Date(year, 5, 30) // 30 de junio

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
                <thead>
                    <tr className="text-carbon-500 text-xs">
                        <th className="text-left pb-2">Hoy es</th>
                        <th className="text-left pb-2">Estado</th>
                        <th className="text-right pb-2">Cuota ${base.toLocaleString('es-AR')}</th>
                        <th className="text-center pb-2">QR</th>
                    </tr>
                </thead>
                <tbody>
                    {days.map((day) => {
                        const ref = new Date(year, 6, day) // julio
                        const r = evaluateBilling(config, {
                            endDate: dueDate,
                            role: 'member',
                            referenceDate: ref,
                        })
                        return (
                            <tr key={day} className="border-t border-carbon-800">
                                <td className="py-1.5">{day} jul</td>
                                <td className="py-1.5 text-carbon-400">{r.tierLabel ?? r.phase}</td>
                                <td className="py-1.5 text-right">
                                    ${Math.round(base * r.multiplier).toLocaleString('es-AR')}
                                </td>
                                <td className="py-1.5 text-center">{r.blocksAccess ? '🔴' : '🟢'}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function validateTiers(tiers: BillingTier[]): string[] {
    const warnings: string[] = []

    tiers.forEach((t, i) => {
        if (t.to_day !== null && t.to_day < t.from_day) {
            warnings.push(`Tramo "${t.label}": el día de fin (${t.to_day}) es anterior al de inicio (${t.from_day}).`)
        }

        const next = tiers[i + 1]
        if (!next) return

        const end = t.to_day ?? 31
        if (next.from_day <= end) {
            warnings.push(`"${t.label}" y "${next.label}" se solapan en el día ${next.from_day}.`)
        } else if (next.from_day > end + 1) {
            warnings.push(
                `Días ${end + 1} a ${next.from_day - 1} sin tramo: se van a tratar como "sin recargo".`
            )
        }
    })

    if (tiers.length && tiers[0].from_day > 1) {
        warnings.push(`Los días 1 a ${tiers[0].from_day - 1} no tienen tramo: se tratan como "sin recargo".`)
    }

    return warnings
}

function NumberField({
    label,
    value,
    min,
    max,
    onChange,
    nullable = false,
    placeholder,
    hint,
    block = false,
}: {
    label: string
    value: number | null
    min?: number
    max?: number
    onChange: (v: number | null) => void
    nullable?: boolean
    placeholder?: string
    hint?: string
    block?: boolean
}) {
    return (
        <div className={block ? '' : 'min-w-0'}>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-carbon-400 mb-1">{label}</label>
            <input
                type="number"
                min={min}
                max={max}
                placeholder={placeholder}
                value={value ?? ''}
                onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') return onChange(nullable ? null : 0)
                    onChange(Number(raw))
                }}
                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-carbon-900 border border-carbon-200 dark:border-carbon-700 text-sm"
            />
            {hint && <p className="mt-1 text-[10px] text-carbon-500">{hint}</p>}
        </div>
    )
}
