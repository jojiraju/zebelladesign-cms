import { useEffect, useState, type ReactNode } from 'react'
import { Save } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { audit } from '../lib/audit'
import { revalidateStorefront } from '../lib/api'
import { clean, errMsg } from '../lib/util'
import { useAuth } from '../lib/auth'
import type { Permission } from '../lib/permissions'
import { ErrorBox, PageHeader, Spinner, useToast } from './ui'

/** Loads one settings-style document, hands the editable draft to `children`, and saves with audit + cache refresh. */
export function DocEditor<T extends object>({ col, id, title, subtitle, permission, defaults, children }: {
  col: string; id: string; title: string; subtitle?: string; permission: Permission; defaults: T
  children(draft: T, set: <K extends keyof T>(k: K, v: T[K]) => void): ReactNode
}) {
  const { can } = useAuth()
  const toast = useToast()
  const [draft, setDraft] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getDoc(doc(db, col, id)).then((s) => setDraft({ ...defaults, ...(s.exists() ? (s.data() as T) : {}) })).catch((e) => setErr(errMsg(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [col, id])

  if (err) return <ErrorBox message={err} />
  if (!draft) return <Spinner />
  const writable = can(permission)
  const set = <K extends keyof T>(k: K, v: T[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  async function save() {
    setBusy(true)
    try {
      await setDoc(doc(db, col, id), clean({ ...draft, updatedAt: Date.now() }), { merge: true })
      await audit(`${col}.${id}.update`, `${col}/${id}`)
      void revalidateStorefront()
      toast('Saved — the storefront will refresh within a minute')
    } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }}>
      <PageHeader sticky title={title} subtitle={subtitle} actions={writable ? <button className="btn btn-solid" disabled={busy}><Save size={15} />{busy ? 'Saving…' : 'Save changes'}</button> : undefined} />
      {!writable && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Read only for your role.</p>}
      <fieldset disabled={!writable} className="space-y-6">{children(draft, set)}</fieldset>
    </form>
  )
}

/** Editable list of objects with add / remove. */
export function RepeatList<T>({ items, onChange, blank, max, addLabel, render }: {
  items: T[]; onChange(next: T[]): void; blank: T; max?: number; addLabel: string; render(item: T, patch: (p: Partial<T>) => void, i: number): ReactNode
}) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="relative rounded-xl border border-line bg-ivory/70 p-4">
          {render(it, (p) => onChange(items.map((x, k) => (k === i ? { ...x, ...p } : x))), i)}
          <button type="button" className="btn btn-sm btn-danger mt-3" onClick={() => onChange(items.filter((_, k) => k !== i))}>Remove</button>
        </div>
      ))}
      {(max == null || items.length < max) && <button type="button" className="btn btn-sm" onClick={() => onChange([...items, blank])}>+ {addLabel}</button>}
    </div>
  )
}
