'use client'

import { useMemo, useState } from 'react'
import { Building2, Check, Loader2, Plus, Store } from 'lucide-react'
import { toast } from 'sonner'

import { FEATURE_LABELS, FEATURES_BY_PLAN, getDojoLimit, resolveFeatures } from '@/lib/features'
import {
    DEFAULT_BILLING,
    type BillingConfig,
    type Branding,
    type Dojo,
    type FeatureKey,
    type Organization,
    type Plan,
} from '@/lib/tenant/types'

import BillingRulesEditor from './BillingRulesEditor'
import TeamEditor from './TeamEditor'
import DojoLocationPicker from './DojoLocationPicker'
import OrgAdminsEditor from './OrgAdminsEditor'

/**
 * Console — Panel de plataforma.
 *
 * Columna izquierda: el árbol de organizaciones y sus sedes.
 * Columna derecha: el editor de lo que esté seleccionado.
 *
 * Se edita en estado local y se guarda explícitamente, para no disparar un
 * write por cada tecla sobre una config que afecta a todo un dojo.
 */
export default function Console({
    orgs: initialOrgs,
    dojos: initialDojos,
    memberCounts,
}: {
    orgs: Organization[]
    dojos: Dojo[]
    memberCounts: Record<string, number>
}) {
    const [orgs, setOrgs] = useState(initialOrgs)
    const [dojos, setDojos] = useState(initialDojos)
    const [selected, setSelected] = useState<{ type: 'org' | 'dojo'; id: string } | null>(
        initialOrgs[0] ? { type: 'org', id: initialOrgs[0].id } : null
    )

    const dojosByOrg = useMemo(
        () =>
            dojos.reduce<Record<string, Dojo[]>>((acc, d) => {
                ;(acc[d.org_id] ??= []).push(d)
                return acc
            }, {}),
        [dojos]
    )

    const createOrg = async () => {
        const name = prompt('Nombre de la organización (ej: Lotus Club)')?.trim()
        if (!name) return

        const res = await fetch('/api/superadmin/orgs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
        const json = await res.json()

        if (!res.ok) return toast.error(json.error ?? 'No se pudo crear')

        setOrgs((prev) => [...prev, json.org])
        setSelected({ type: 'org', id: json.org.id })
        toast.success(`Organización "${name}" creada`)
    }

    const createDojo = async (orgId: string) => {
        const org = orgs.find((o) => o.id === orgId)
        const limit = getDojoLimit(org?.plan ?? 'basic')
        const current = dojosByOrg[orgId]?.length ?? 0

        if (limit !== null && current >= limit) {
            return toast.error(`El plan ${org?.plan} permite ${limit} sede${limit === 1 ? '' : 's'}. Subí a Pro.`)
        }

        const name = prompt('Nombre de la sede (ej: Lotus Lanús)')?.trim()
        if (!name) return

        const res = await fetch('/api/superadmin/dojos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: orgId, name }),
        })
        const json = await res.json()

        if (!res.ok) return toast.error(json.error ?? 'No se pudo crear')

        setDojos((prev) => [...prev, json.dojo])
        setSelected({ type: 'dojo', id: json.dojo.id })
        toast.success(`Sede "${name}" creada`)
    }

    const selectedOrg = selected?.type === 'org' ? orgs.find((o) => o.id === selected.id) : null
    const selectedDojo = selected?.type === 'dojo' ? dojos.find((d) => d.id === selected.id) : null

    return (
        <div className="min-h-screen flex flex-col md:flex-row">
            {/* ---- Árbol ------------------------------------------------- */}
            <aside className="w-full md:w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 p-4 md:h-screen md:overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-lg font-black">Plataforma</h1>
                        <p className="text-xs text-slate-400">
                            {orgs.length} organización{orgs.length === 1 ? '' : 'es'} · {dojos.length} sedes
                        </p>
                    </div>
                    <button
                        onClick={createOrg}
                        className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        title="Nueva organización"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-4">
                    {orgs.map((org) => (
                        <div key={org.id}>
                            <button
                                onClick={() => setSelected({ type: 'org', id: org.id })}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${
                                    selected?.type === 'org' && selected.id === org.id
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                <Building2 className="w-4 h-4 shrink-0" />
                                <span className="flex-1 font-bold text-sm truncate">{org.name}</span>
                                <span
                                    className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                                        org.plan === 'pro'
                                            ? 'bg-amber-400 text-amber-950'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                    }`}
                                >
                                    {org.plan}
                                </span>
                            </button>

                            <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 dark:border-slate-700 pl-3">
                                {(dojosByOrg[org.id] ?? []).map((dojo) => (
                                    <button
                                        key={dojo.id}
                                        onClick={() => setSelected({ type: 'dojo', id: dojo.id })}
                                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors ${
                                            selected?.type === 'dojo' && selected.id === dojo.id
                                                ? 'bg-slate-200 dark:bg-slate-700'
                                                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="flex-1 text-sm truncate">{dojo.name}</span>
                                        <span className="text-[10px] text-slate-400">
                                            {memberCounts[dojo.id] ?? 0}
                                        </span>
                                    </button>
                                ))}

                                <button
                                    onClick={() => createDojo(org.id)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-xs text-slate-400 hover:text-blue-500 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Agregar sede
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* ---- Editor ------------------------------------------------ */}
            <main className="flex-1 p-6 md:p-10 md:h-screen md:overflow-y-auto">
                {selectedOrg && (
                    <OrgEditor
                        key={selectedOrg.id}
                        org={selectedOrg}
                        dojoCount={dojosByOrg[selectedOrg.id]?.length ?? 0}
                        onSaved={(next) => setOrgs((prev) => prev.map((o) => (o.id === next.id ? next : o)))}
                    />
                )}

                {selectedDojo && (
                    <DojoEditor
                        key={selectedDojo.id}
                        dojo={selectedDojo}
                        onSaved={(next) => setDojos((prev) => prev.map((d) => (d.id === next.id ? next : d)))}
                    />
                )}

                {!selectedOrg && !selectedDojo && (
                    <p className="text-slate-400">Elegí una organización o una sede.</p>
                )}
            </main>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Editor de organización: identidad, plan y features
// ---------------------------------------------------------------------------

function OrgEditor({
    org,
    dojoCount,
    onSaved,
}: {
    org: Organization
    dojoCount: number
    onSaved: (next: Organization) => void
}) {
    const [draft, setDraft] = useState(org)
    const [saving, setSaving] = useState(false)

    const features = resolveFeatures(draft.plan, draft.features)
    const limit = getDojoLimit(draft.plan)

    const save = async () => {
        setSaving(true)
        const res = await fetch('/api/superadmin/orgs', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: draft.id,
                name: draft.name,
                slug: draft.slug,
                plan: draft.plan,
                features: draft.features,
                branding: draft.branding,
                is_active: draft.is_active,
            }),
        })
        const json = await res.json()
        setSaving(false)

        if (!res.ok) return toast.error(json.error ?? 'No se pudo guardar')

        onSaved(json.org)
        toast.success('Guardado. Los cambios aplican sin redeploy.')
    }

    /**
     * Un override sólo se guarda si difiere del default del plan. Así, al pasar
     * de Basic a Pro, las features no quedan clavadas por overrides viejos.
     */
    const toggleFeature = (key: FeatureKey) => {
        const planDefault = FEATURES_BY_PLAN[draft.plan][key]
        const current = features[key]
        const next = { ...draft.features }

        if (!current === planDefault) delete next[key]
        else next[key] = !current

        setDraft({ ...draft, features: next })
    }

    return (
        <div className="max-w-3xl space-y-8">
            <Header title={draft.name} subtitle="Organización" onSave={save} saving={saving} />

            <Section title="Identidad">
                <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Nombre" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
                    <Field
                        label="Slug"
                        value={draft.slug}
                        hint="Identificador corto, sin espacios"
                        onChange={(v) => setDraft({ ...draft, slug: v })}
                    />
                </div>
            </Section>

            <Section
                title="Superadmins"
                hint="Quiénes administran esta marca. Ven todas sus sedes y dan de alta nuevas, pero no entran a esta consola."
            >
                <OrgAdminsEditor orgId={draft.id} orgName={draft.name} />
            </Section>

            <Section title="Marca" hint="Aplica a todas las sedes que no definan la suya">
                <BrandingFields
                    value={draft.branding}
                    onChange={(branding) => setDraft({ ...draft, branding })}
                />
            </Section>

            <Section title="Plan">
                <div className="flex gap-3 mb-4">
                    {(['basic', 'pro'] as Plan[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setDraft({ ...draft, plan: p })}
                            className={`flex-1 p-4 rounded-2xl border-2 text-left transition-colors ${
                                draft.plan === p
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            <p className="font-black uppercase text-sm">{p}</p>
                            <p className="text-xs text-slate-500">
                                {getDojoLimit(p) === null ? 'Sedes ilimitadas' : `${getDojoLimit(p)} sede`}
                            </p>
                        </button>
                    ))}
                </div>

                {limit !== null && dojoCount > limit && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
                        ⚠ Esta organización tiene {dojoCount} sedes y el plan {draft.plan} permite {limit}. Las
                        existentes siguen funcionando, pero no vas a poder crear más.
                    </p>
                )}

                <div className="grid md:grid-cols-2 gap-2">
                    {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => {
                        const on = features[key]
                        const overridden = draft.features[key] !== undefined
                        return (
                            <button
                                key={key}
                                onClick={() => toggleFeature(key)}
                                className={`flex items-center gap-2 p-2.5 rounded-xl text-left text-sm transition-colors ${
                                    on
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400'
                                }`}
                            >
                                <span
                                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                                        on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                >
                                    {on && <Check className="w-3 h-3 text-white" />}
                                </span>
                                <span className="flex-1 truncate">{FEATURE_LABELS[key]}</span>
                                {overridden && (
                                    <span
                                        className="text-[9px] font-black uppercase text-amber-500"
                                        title="Difiere del default del plan"
                                    >
                                        custom
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </Section>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Editor de sede: datos, marca propia y política de cobro
// ---------------------------------------------------------------------------

function DojoEditor({ dojo, onSaved }: { dojo: Dojo; onSaved: (next: Dojo) => void }) {
    const [draft, setDraft] = useState<Dojo>({
        ...dojo,
        billing: { ...DEFAULT_BILLING, ...(dojo.billing ?? {}) },
    })
    const [saving, setSaving] = useState(false)
    const [tab, setTab] = useState<'datos' | 'equipo' | 'cobro' | 'marca'>('datos')

    const save = async () => {
        setSaving(true)
        const res = await fetch('/api/superadmin/dojos', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft),
        })
        const json = await res.json()
        setSaving(false)

        if (!res.ok) return toast.error(json.error ?? 'No se pudo guardar')

        onSaved(json.dojo)
        toast.success('Guardado. Aplica al instante en esta sede.')
    }

    return (
        <div className="max-w-3xl space-y-6">
            <Header title={draft.name} subtitle="Sede" onSave={save} saving={saving} />

            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit">
                {(['datos', 'equipo', 'cobro', 'marca'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${
                            tab === t ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'
                        }`}
                    >
                        {t === 'cobro' ? 'Lógica de cobro' : t}
                    </button>
                ))}
            </div>

            {tab === 'datos' && (
                <Section title="Datos de la sede">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Nombre" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
                        <Field label="Slug" value={draft.slug} onChange={(v) => setDraft({ ...draft, slug: v })} />
                        <Field
                            label="Ciudad"
                            value={draft.city ?? ''}
                            onChange={(v) => setDraft({ ...draft, city: v })}
                        />
                        <Field
                            label="Dirección"
                            value={draft.address ?? ''}
                            onChange={(v) => setDraft({ ...draft, address: v })}
                        />
                        <Field
                            label="Teléfono"
                            value={draft.phone ?? ''}
                            onChange={(v) => setDraft({ ...draft, phone: v })}
                        />
                        <Field
                            label="Zona horaria"
                            value={draft.timezone}
                            hint="Define qué día del mes es 'hoy' para los recargos"
                            onChange={(v) => setDraft({ ...draft, timezone: v })}
                        />
                    </div>

                    {/* La ubicación es lo que hace que la sede aparezca en el
                        mapa de la landing: sin lat/lng no hay pin que dibujar. */}
                    <div className="mt-6">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                            Ubicación en el mapa
                        </h4>
                        <p className="text-xs text-slate-500 mb-3">
                            Define dónde se marca esta sede en la web pública.
                        </p>
                        <DojoLocationPicker
                            address={draft.address ?? ''}
                            city={draft.city ?? ''}
                            lat={draft.lat}
                            lng={draft.lng}
                            onChange={({ lat, lng }) => setDraft({ ...draft, lat, lng })}
                            onAddressResolved={({ address, city }) =>
                                setDraft((prev) => ({ ...prev, address, city }))
                            }
                        />
                    </div>
                </Section>
            )}

            {tab === 'equipo' && (
                <Section
                    title="Equipo de la sede"
                    hint="Quién administra este dojo. Cada persona sólo ve la sede donde tiene un rol."
                >
                    <TeamEditor dojoId={dojo.id} dojoName={dojo.name} />
                </Section>
            )}

            {tab === 'cobro' && (
                <Section
                    title="Política de cobro"
                    hint="Cada sede define la suya. Esto reemplaza lo que antes estaba hardcodeado."
                >
                    <BillingRulesEditor
                        value={draft.billing as BillingConfig}
                        onChange={(billing) => setDraft({ ...draft, billing })}
                    />
                </Section>
            )}

            {tab === 'marca' && (
                <Section title="Marca de esta sede" hint="Dejá vacío para heredar el de la organización">
                    <BrandingFields
                        value={draft.branding}
                        onChange={(branding) => setDraft({ ...draft, branding })}
                    />
                </Section>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------

function BrandingFields({ value, onChange }: { value: Branding; onChange: (next: Branding) => void }) {
    return (
        <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <ColorField
                    label="Color primario"
                    value={value.primary ?? ''}
                    hint="Vacío = usa el color por defecto del panel"
                    onChange={(v) => onChange({ ...value, primary: v })}
                />
                <ColorField
                    label="Color de acento"
                    value={value.accent ?? ''}
                    onChange={(v) => onChange({ ...value, accent: v })}
                />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                <Field
                    label="URL del logo"
                    value={value.logo_url ?? ''}
                    hint="Subilo a Supabase Storage (bucket 'branding') y pegá la URL pública"
                    onChange={(v) => onChange({ ...value, logo_url: v })}
                />
                <Field
                    label="Nombre a mostrar"
                    value={value.display_name ?? ''}
                    hint="Si difiere del nombre legal"
                    onChange={(v) => onChange({ ...value, display_name: v })}
                />
            </div>
        </div>
    )
}

function Header({
    title,
    subtitle,
    onSave,
    saving,
}: {
    title: string
    subtitle: string
    onSave: () => void
    saving: boolean
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{subtitle}</p>
                <h2 className="text-2xl font-black">{title}</h2>
            </div>
            <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 h-11 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar
            </button>
        </div>
    )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{title}</h3>
            {hint && <p className="text-xs text-slate-500 mb-3">{hint}</p>}
            <div className={hint ? '' : 'mt-3'}>{children}</div>
        </section>
    )
}

function Field({
    label,
    value,
    onChange,
    hint,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    hint?: string
}) {
    return (
        <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            />
            {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
        </div>
    )
}

function ColorField({
    label,
    value,
    onChange,
    hint,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    hint?: string
}) {
    return (
        <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</label>
            <div className="flex gap-2">
                <input
                    type="color"
                    value={value || '#1E40AF'}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-12 h-10 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
                />
                <input
                    type="text"
                    value={value}
                    placeholder="#1E40AF"
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="px-3 h-10 rounded-xl text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                        title="Quitar color y volver al default"
                    >
                        Limpiar
                    </button>
                )}
            </div>
            {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
        </div>
    )
}
