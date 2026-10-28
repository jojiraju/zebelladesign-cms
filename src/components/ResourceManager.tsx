import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, getDoc, orderBy, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useDocs, type Doc } from '../lib/hooks'
import { audit } from '../lib/audit'
import { revalidateStorefront } from '../lib/api'
import { errMsg, fmtDate, slugify, toPaise, toRupees } from '../lib/util'
import { useAuth } from '../lib/auth'
import type { Permission } from '../lib/permissions'
import { ArrowLeft, FileText, Image as ImageIcon, Pencil, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Badge, Empty, ErrorBox, Field, IconButton, PageHeader, Section, Spinner, Switch, useToast } from './ui'
import { DataTable, type TableColumn } from './DataTable'
import { SingleImage } from './ImageUploader'

type Rec = Record<string, unknown>

export type FieldDef =
  | { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'money' | 'bool' | 'datetime' | 'idlist'; hint?: string; required?: boolean; upper?: boolean }
  | { key: string; label: string; type: 'select'; options: [string, string][]; hint?: string; required?: boolean }
  | { key: string; label: string; type: 'image'; folder: string }

export interface ResourceConfig {
  collection: string
  /** Route of the list page, e.g. '/categories' (the editor lives at `<path>/new` and `<path>/:id`). */
  path: string
  title: string
  singular: string
  permission: Permission
  fields: FieldDef[]
  /** Fields shown in the table */
  columns: { key: string; label: string; render?(v: unknown, row: Rec): ReactNode }[]
  /** Derive the document id from a field (e.g. slug). Otherwise Firestore auto-ids. */
  idFrom?: string
  /** Auto-fill `slug` from this field's value while creating. */
  slugFrom?: string
  defaults: Rec
  orderBy?: string
  description?: string
  revalidate?: boolean
  /** Fields written only when a document is first created. */
  onCreate?: Rec
  /** Adjust the stored document just before saving (e.g. unit conversion). */
  beforeSave?(body: Rec): Rec
  /** Adjust the editable form right after loading a document. */
  afterLoad?(form: Rec, row: Rec): Rec
}

const toForm = (cfg: ResourceConfig, row: Rec): Rec => {
  const out: Rec = {}
  for (const f of cfg.fields) {
    const v = row[f.key]
    if (f.type === 'money') out[f.key] = toRupees(v as number | null)
    else if (f.type === 'datetime') out[f.key] = v ? new Date(v as number).toISOString().slice(0, 16) : ''
    else if (f.type === 'idlist') out[f.key] = Array.isArray(v) ? (v as string[]).join(', ') : ''
    else out[f.key] = v ?? (f.type === 'bool' ? false : '')
  }
  return cfg.afterLoad ? cfg.afterLoad(out, row) : out
}

function fromForm(cfg: ResourceConfig, form: Rec): Rec {
  const out: Rec = {}
  for (const f of cfg.fields) {
    const v = form[f.key]
    if (f.type === 'money') out[f.key] = v === '' || v == null ? null : toPaise(v as string)
    else if (f.type === 'number') out[f.key] = v === '' || v == null ? null : Number(v)
    else if (f.type === 'datetime') out[f.key] = v ? new Date(v as string).getTime() : null
    else if (f.type === 'idlist') out[f.key] = String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    else if (f.type === 'text' && f.upper) out[f.key] = String(v ?? '').trim().toUpperCase()
    else if (f.type === 'text' || f.type === 'textarea') out[f.key] = String(v ?? '').trim()
    else out[f.key] = v
  }
  return out
}

export function ResourceManager({ cfg }: { cfg: ResourceConfig }) {
  const { can } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [constraints] = useState(() => (cfg.orderBy ? [orderBy(cfg.orderBy)] : []))
  const { data, loading, error, reload } = useDocs<Rec>(cfg.collection, constraints)
  const writable = can(cfg.permission)

  async function remove(row: Doc<Rec>) {
    if (!window.confirm(`Delete this ${cfg.singular.toLowerCase()}? This cannot be undone.`)) return
    try {
      await deleteDoc(doc(db, cfg.collection, row.id))
      await audit(`${cfg.collection}.delete`, row.id)
      if (cfg.revalidate !== false) void revalidateStorefront()
      toast(`${cfg.singular} deleted`)
      reload()
    } catch (e) { toast(errMsg(e), 'error') }
  }

  const columns: TableColumn<Doc<Rec>>[] = [
    ...cfg.columns.map((c, i): TableColumn<Doc<Rec>> => ({
      id: c.key, name: c.label, sortable: true, selector: (r) => { const v = r[c.key]; return typeof v === 'number' || typeof v === 'string' ? v : v ? 1 : 0 },
      grow: i === 0 ? 2 : 1, minWidth: i === 0 ? '180px' : '110px', wrap: true,
      cell: (r) => (c.render ? c.render(r[c.key], r) : <span className={i === 0 ? 'font-medium' : ''}>{String(r[c.key] ?? '—')}</span>),
    })),
    { name: '', right: true, minWidth: '110px', cell: (row) => writable ? (
      <div className="flex gap-1.5">
        <IconButton label="Edit" tone="brand" to={`${cfg.path}/${row.id}`}><Pencil size={15} /></IconButton>
        <IconButton label="Delete" tone="danger" onClick={() => remove(row)}><Trash2 size={15} /></IconButton>
      </div>
    ) : <Badge>Read only</Badge> },
  ]

  return (
    <div>
      <PageHeader title={cfg.title} subtitle={cfg.description}
        actions={writable && <Link to={`${cfg.path}/new`} className="btn btn-solid"><Plus size={16} />New {cfg.singular.toLowerCase()}</Link>} />
      {error && <ErrorBox message={error} />}
      <DataTable columns={columns} data={data} loading={loading} onRowClicked={writable ? (r) => nav(`${cfg.path}/${r.id}`) : undefined}
        searchText={(r) => cfg.columns.map((c) => String(r[c.key] ?? '')).join(' ')} searchPlaceholder={`Search ${cfg.title.toLowerCase()}`}
        empty={<Empty title={`No ${cfg.title.toLowerCase()} yet`} text={writable ? `Create your first ${cfg.singular.toLowerCase()} to get started.` : undefined}>{writable && <Link to={`${cfg.path}/new`} className="btn btn-solid">New {cfg.singular.toLowerCase()}</Link>}</Empty>} />
    </div>
  )
}

/** Full-page create / edit form for a ResourceConfig (route: `<path>/new` and `<path>/:id`). */
export function ResourceEditor({ cfg }: { cfg: ResourceConfig }) {
  const { id } = useParams()
  const isNew = !id
  const { can } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState<Rec | null>(isNew ? toForm(cfg, cfg.defaults) : null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const writable = can(cfg.permission)

  useEffect(() => {
    if (isNew) return
    getDoc(doc(db, cfg.collection, id!)).then((s) => (s.exists() ? setForm(toForm(cfg, s.data() as Rec)) : setLoadErr(`${cfg.singular} not found.`))).catch((e) => setLoadErr(errMsg(e)))
  }, [cfg, id, isNew])

  const back = <Link to={cfg.path} className="link inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} />All {cfg.title.toLowerCase()}</Link>
  if (loadErr) return <div>{back}<div className="mt-4"><ErrorBox message={loadErr} /></div></div>
  if (!form) return <Spinner />
  const set = (k: string, v: unknown) => setForm((s) => (s ? { ...s, [k]: v } : s))

  async function save() {
    if (!form) return
    for (const f of cfg.fields) {
      if ('required' in f && f.required && !String(form[f.key] ?? '').trim()) return toast(`${f.label} is required.`, 'error')
    }
    setBusy(true)
    try {
      let body: Rec = { ...fromForm(cfg, form), updatedAt: Date.now() }
      if (cfg.beforeSave) body = cfg.beforeSave(body)
      if (cfg.slugFrom && !body.slug) body.slug = slugify(String(body[cfg.slugFrom] ?? ''))
      let docId = id
      if (!docId) {
        body = { ...body, ...cfg.onCreate, createdAt: Date.now() }
        if (cfg.idFrom) {
          docId = String(body[cfg.idFrom] || '')
          if (!docId) throw new Error('A unique key is required.')
          if ((await getDoc(doc(db, cfg.collection, docId))).exists()) throw new Error(`"${docId}" already exists.`)
          await setDoc(doc(db, cfg.collection, docId), body)
        } else docId = (await addDoc(collection(db, cfg.collection), body)).id
      } else await setDoc(doc(db, cfg.collection, docId), body, { merge: true })
      await audit(`${cfg.collection}.${isNew ? 'create' : 'update'}`, docId)
      if (cfg.revalidate !== false) void revalidateStorefront()
      toast(`${cfg.singular} saved`)
      nav(cfg.path)
    } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  const textFields = cfg.fields.filter((f) => f.type !== 'image' && f.type !== 'bool')
  const imageFields = cfg.fields.filter((f): f is Extract<FieldDef, { type: 'image' }> => f.type === 'image')
  const boolFields = cfg.fields.filter((f) => f.type === 'bool')

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }}>
      <PageHeader sticky title={`${isNew ? 'New' : 'Edit'} ${cfg.singular.toLowerCase()}`} subtitle={cfg.description} back={back}
        actions={<>
          <Link to={cfg.path} className="btn">Cancel</Link>
          {writable && <button className="btn btn-solid" disabled={busy}><Save size={15} />{busy ? 'Saving…' : `Save ${cfg.singular.toLowerCase()}`}</button>}
        </>} />
      <fieldset disabled={!writable} className="space-y-6">
        {!writable && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Read only for your role.</p>}
        <Section title="Details" icon={FileText} tone="rose" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {textFields.map((f) => {
            const v = form[f.key]
            const wide = f.type === 'textarea' || f.type === 'idlist'
            return (
              <Field key={f.key} label={f.label} hint={'hint' in f ? f.hint : undefined} className={wide ? "sm:col-span-2 xl:col-span-3" : ""}>
                {f.type === 'textarea' ? <textarea rows={4} className="field" value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} />
                  : f.type === 'select' ? <select className="field" value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)}>{f.options.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select>
                  : <input className="field" type={f.type === 'datetime' ? 'datetime-local' : f.type === 'number' || f.type === 'money' ? 'number' : 'text'} step={f.type === 'money' ? '0.01' : undefined} min={f.type === 'money' || f.type === 'number' ? 0 : undefined}
                      value={String(v ?? '')} onChange={(e) => {
                        set(f.key, e.target.value)
                        if (isNew && cfg.slugFrom === f.key && 'slug' in form) set('slug', slugify(e.target.value))
                      }} disabled={!isNew && cfg.idFrom === f.key} />}
              </Field>
            )
          })}
        </Section>
        {imageFields.length > 0 && (
          <Section title="Images" icon={ImageIcon} tone="violet" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {imageFields.map((f) => <SingleImage key={f.key} label={f.label} value={form[f.key] as string} folder={f.folder} onChange={(u) => set(f.key, u)} />)}
          </Section>
        )}
        {boolFields.length > 0 && (
          <Section title="Options" icon={SlidersHorizontal} tone="emerald" className="space-y-3">
            {boolFields.map((f) => <Switch key={f.key} checked={!!form[f.key]} onChange={(x) => set(f.key, x)} label={f.label} />)}
          </Section>
        )}
      </fieldset>
    </form>
  )
}

export const dateCol = (v: unknown) => (typeof v === 'number' ? fmtDate(v) : '—')
