/* eslint-disable @typescript-eslint/no-explicit-any */
/** In-memory stand-in for `firebase/firestore`, used in demo mode. Implements just the calls the admin makes. */
import { getSeed, type Row } from './seed'

export const db_ = () => getSeed().db
const lag = () => new Promise((r) => setTimeout(r, 70))
const clone = <T,>(v: T): T => (v === undefined ? v : typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))
const rid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4)

export interface CollRef { type: 'collection'; id: string; path: string }
export interface DocRef { type: 'document'; id: string; path: string; col: string }
export type QueryConstraint = { kind: 'where'; field: string; op: string; value: any } | { kind: 'orderBy'; field: string; dir: 'asc' | 'desc' } | { kind: 'limit'; n: number }
export interface Query { type: 'query'; col: string; cons: QueryConstraint[] }

export const getFirestore = (): any => ({ demo: true })

type AnyRef = CollRef | Query
const colName = (r: AnyRef) => (r.type === 'collection' ? r.id : r.col)

export function collection(_db: unknown, name: string): CollRef { return { type: 'collection', id: name, path: name } }
export function doc(a: any, b?: string, c?: string): DocRef {
  if (a?.type === 'collection') { const id = b ?? rid(); return { type: 'document', id, path: `${a.id}/${id}`, col: a.id } }
  return { type: 'document', id: c as string, path: `${b}/${c}`, col: b as string }
}
export const where = (field: string, op: string, value: any): QueryConstraint => ({ kind: 'where', field, op, value })
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): QueryConstraint => ({ kind: 'orderBy', field, dir })
export const limit = (n: number): QueryConstraint => ({ kind: 'limit', n })
export function query(ref: AnyRef, ...cons: QueryConstraint[]): Query { return { type: 'query', col: colName(ref), cons: [...(ref.type === 'query' ? ref.cons : []), ...cons] } }

const get = (o: any, path: string) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
const cmp = (a: any, b: any) => (a === b ? 0 : a == null ? -1 : b == null ? 1 : a < b ? -1 : 1)
function matches(o: any, c: Extract<QueryConstraint, { kind: 'where' }>) {
  const v = get(o, c.field)
  switch (c.op) {
    case '==': return v === c.value
    case '!=': return v !== c.value
    case '<': return v < c.value
    case '<=': return v <= c.value
    case '>': return v > c.value
    case '>=': return v >= c.value
    case 'in': return Array.isArray(c.value) && c.value.includes(v)
    case 'array-contains': return Array.isArray(v) && v.includes(c.value)
    default: return true
  }
}
function run(q: AnyRef): { id: string; data: Row }[] {
  const col = db_().get(colName(q)) ?? new Map<string, Row>()
  let rows = [...col].map(([id, data]) => ({ id, data }))
  const cons = q.type === 'query' ? q.cons : []
  for (const c of cons) if (c.kind === 'where') rows = rows.filter((r) => matches(r.data, c))
  const orders = cons.filter((c): c is Extract<QueryConstraint, { kind: 'orderBy' }> => c.kind === 'orderBy')
  if (orders.length) rows.sort((a, b) => { for (const o of orders) { const d = cmp(get(a.data, o.field), get(b.data, o.field)); if (d) return o.dir === 'desc' ? -d : d } return 0 })
  const lim = cons.find((c) => c.kind === 'limit') as { n: number } | undefined
  return lim ? rows.slice(0, lim.n) : rows
}

const snap = (col: string, id: string, data: Row | undefined) => ({
  id, ref: { type: 'document', id, path: `${col}/${id}`, col } as DocRef, exists: () => data !== undefined, data: () => clone(data) as any,
})
export async function getDocs(q: AnyRef) {
  await lag()
  const col = colName(q)
  const docs = run(q).map((r) => snap(col, r.id, r.data))
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (f: (d: (typeof docs)[number]) => void) => docs.forEach(f) }
}
export async function getDoc(ref: DocRef) { await lag(); return snap(ref.col, ref.id, db_().get(ref.col)?.get(ref.id)) }
export async function getCountFromServer(q: AnyRef) { await lag(); const count = run(q).length; return { data: () => ({ count }) } }

const strip = (o: any): any => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, strip(v)])) : o)
function merge(a: any, b: any): any {
  if (!b || typeof b !== 'object' || Array.isArray(b) || !a || typeof a !== 'object' || Array.isArray(a)) return b
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = merge(a[k], v)
  return out
}
function write(ref: DocRef, data: Row, opts?: { merge?: boolean }) {
  const store = db_()
  if (!store.has(ref.col)) store.set(ref.col, new Map())
  const cur = store.get(ref.col)!.get(ref.id)
  store.get(ref.col)!.set(ref.id, opts?.merge && cur ? merge(cur, strip(clone(data))) : strip(clone(data)))
}
export async function setDoc(ref: DocRef, data: Row, opts?: { merge?: boolean }) { await lag(); write(ref, data, opts) }
export async function addDoc(c: CollRef, data: Row) { await lag(); const ref = doc(c); write(ref, data); return ref }
export async function deleteDoc(ref: DocRef) { await lag(); db_().get(ref.col)?.delete(ref.id) }
function patch(ref: DocRef, data: Row) {
  const cur = clone(db_().get(ref.col)?.get(ref.id)) ?? {}
  for (const [k, v] of Object.entries(data)) {
    const ks = k.split('.')
    let o = cur
    ks.slice(0, -1).forEach((p) => (o = o[p] ??= {}))
    o[ks[ks.length - 1]] = v
  }
  write(ref, cur)
}
export async function updateDoc(ref: DocRef, data: Row) { await lag(); patch(ref, data) }
export async function runTransaction<T>(_db: unknown, fn: (tx: any) => Promise<T>): Promise<T> {
  await lag()
  return fn({
    get: async (ref: DocRef) => snap(ref.col, ref.id, db_().get(ref.col)?.get(ref.id)),
    set: (ref: DocRef, data: Row, opts?: { merge?: boolean }) => write(ref, data, opts),
    update: (ref: DocRef, data: Row) => patch(ref, data),
    delete: (ref: DocRef) => db_().get(ref.col)?.delete(ref.id),
  })
}
