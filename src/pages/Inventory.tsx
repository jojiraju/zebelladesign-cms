import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { ArrowLeft, History, Package, Save, SlidersHorizontal } from 'lucide-react'
import { db } from '../lib/firebase'
import { api, revalidateStorefront } from '../lib/api'
import { useDocs, type Doc } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { errMsg, fmtDate } from '../lib/util'
import { Badge, ErrorBox, Field, IconButton, PageHeader, Section, Spinner, useToast } from '../components/ui'
import { DataTable, type TableColumn } from '../components/DataTable'

interface Variant { id: string; sku: string; size?: string; color?: string; stock: number; reserved: number }
interface Product { name: string; sku: string; variants: Variant[]; lowStockThreshold: number; status: string }
interface Row { p: Doc<Product>; v: Variant; avail: number }
interface Movement { id: string; variantId: string; delta: number; reason: string; orderId?: string; actor?: string; createdAt: number }

const vname = (v: Variant) => [v.size, v.color].filter(Boolean).join(' / ') || 'Default'

const histCols: TableColumn<Movement>[] = [
  { id: 'when', name: 'When', sortable: true, selector: (m) => m.createdAt, grow: 1.4, minWidth: '160px', cell: (m) => fmtDate(m.createdAt) },
  { name: 'Change', sortable: true, selector: (m) => m.delta, minWidth: '110px', cell: (m) => <span><b className={m.delta < 0 ? 'text-danger' : 'text-ok'}>{m.delta > 0 ? '+' : ''}{m.delta}</b> <span className="text-xs text-taupe-deep">{m.variantId}</span></span> },
  { name: 'Reason', grow: 2, minWidth: '160px', wrap: true, cell: (m) => <span>{m.reason}{m.orderId && ` · ${m.orderId}`}</span> },
]

/* ============================== list ============================== */
export default function InventoryPage() {
  const { can } = useAuth()
  const { data, loading, error } = useDocs<Product>('products')
  const [onlyLow, setOnlyLow] = useState(false)

  const rows = useMemo<Row[]>(() => data.flatMap((p) => p.variants.map((v) => ({ p, v, avail: v.stock - v.reserved }))).filter((r) => !onlyLow || r.avail <= r.p.lowStockThreshold), [data, onlyLow])

  const columns: TableColumn<Row>[] = [
    { id: 'product', name: 'Product', sortable: true, selector: (r) => r.p.name, grow: 1.6, minWidth: '180px', cell: (r) => <span className="font-medium">{r.p.name}</span> },
    { id: 'variant', name: 'Variant', sortable: true, selector: (r) => r.v.sku, grow: 1.3, minWidth: '150px', cell: (r) => <div><p>{vname(r.v)}</p><p className="text-xs text-taupe-deep">{r.v.sku}</p></div> },
    { id: 'stock', name: 'On hand', sortable: true, selector: (r) => r.v.stock, minWidth: '100px', cell: (r) => r.v.stock },
    { id: 'held', name: 'Held', sortable: true, selector: (r) => r.v.reserved, minWidth: '90px', cell: (r) => r.v.reserved },
    { id: 'avail', name: 'Available', sortable: true, selector: (r) => r.avail, minWidth: '120px', cell: (r) => (r.avail <= 0 ? <Badge tone="bad">Sold out</Badge> : r.avail <= r.p.lowStockThreshold ? <Badge tone="warn">{r.avail} low</Badge> : <b>{r.avail}</b>) },
    { name: '', right: true, minWidth: '110px', cell: (r) => (
      <div className="flex gap-1.5">
        <IconButton label="History" to={`/inventory/${r.p.id}/history`}><History size={15} /></IconButton>
        {can('inventory:write') && <IconButton label="Adjust stock" tone="brand" to={`/inventory/${r.p.id}/adjust?v=${encodeURIComponent(r.v.id)}`}><SlidersHorizontal size={15} /></IconButton>}
      </div>) },
  ]

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Available = on hand − held by open checkouts. Every change is logged." />
      {error && <ErrorBox message={error} />}
      <DataTable columns={columns} data={rows} loading={loading} searchText={(r) => `${r.p.name} ${r.v.sku} ${r.v.size ?? ''} ${r.v.color ?? ''}`} searchPlaceholder="Search product, SKU, size or colour"
        empty={onlyLow ? 'Nothing is running low.' : 'Add products with variants to track stock here.'}
        filters={<label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="check" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />Low stock only</label>} />
    </div>
  )
}

function useProduct(pid?: string) {
  const [p, setP] = useState<Doc<Product> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    getDoc(doc(db, 'products', pid!)).then((s) => (s.exists() ? setP({ ...(s.data() as Product), id: s.id }) : setErr('Product not found.'))).catch((e) => setErr(errMsg(e)))
  }, [pid])
  return { p, err }
}

const back = <Link to="/inventory" className="link inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} />Inventory</Link>
const REASONS = ['New delivery', 'Stock count correction', 'Damaged', 'Returned by customer']

/* ============================== adjust (page) ============================== */
export function InventoryAdjustPage() {
  const { pid } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const { p, err } = useProduct(pid)
  const [vid, setVid] = useState(sp.get('v') ?? '')
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (err) return <div>{back}<div className="mt-4"><ErrorBox message={err} /></div></div>
  if (!p) return <Spinner />
  const v = p.variants.find((x) => x.id === vid) ?? p.variants[0]
  if (!v) return <div>{back}<div className="mt-4"><ErrorBox message="This product has no variants." /></div></div>
  const d = Math.trunc(Number(delta)) || 0
  const after = v.stock + d

  async function submit() {
    if (!d) return toast('Enter a non-zero change (use a minus sign to remove stock).', 'error')
    if (after < v.reserved) return toast(`That would leave less stock than the ${v.reserved} currently held by open checkouts.`, 'error')
    if (reason.trim().length < 2) return toast('Please give a reason.', 'error')
    setBusy(true)
    try {
      await api('/api/admin/inventory', { method: 'POST', body: JSON.stringify({ productId: p!.id, variantId: v.id, delta: d, reason }) })
      toast('Stock updated'); void revalidateStorefront(); nav('/inventory')
    } catch (e) { toast(errMsg(e), 'error'); setBusy(false) }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
      <PageHeader sticky title="Adjust stock" subtitle={p.name} back={back}
        actions={<><Link to="/inventory" className="btn">Cancel</Link><button className="btn btn-solid" disabled={busy}><Save size={15} />{busy ? 'Saving…' : 'Apply change'}</button></>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Section title="Variant" hint="Choose which size / colour to adjust." icon={Package} tone="sky">
            <div className="flex flex-wrap gap-2">
              {p.variants.map((x) => (
                <button type="button" key={x.id} onClick={() => setVid(x.id)}
                  className={`rounded-xl border px-3.5 py-2 text-left text-sm transition ${x.id === v.id ? 'border-transparent bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-md' : 'border-line bg-white hover:border-gold/60'}`}>
                  <span className="block font-medium">{vname(x)}</span><span className={`text-xs ${x.id === v.id ? 'text-white/80' : 'text-taupe-deep'}`}>{x.sku}</span>
                </button>
              ))}
            </div>
          </Section>
          <Section title="Stock change" hint="Positive adds stock, negative removes it." icon={SlidersHorizontal} tone="emerald" className="space-y-4">
            <Field label="Change (+ add / − remove)">
              <input type="number" step={1} className="field" value={delta} onChange={(e) => setDelta(e.target.value)} autoFocus />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {[-10, -1, 1, 5, 10, 50].map((n) => <button type="button" key={n} className="btn btn-sm" onClick={() => setDelta(String((Math.trunc(Number(delta)) || 0) + n))}>{n > 0 ? `+${n}` : n}</button>)}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDelta('')}>Clear</button>
            </div>
            <Field label="Reason" hint="Saved in the inventory log.">
              <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. new delivery" />
            </Field>
            <div className="flex flex-wrap gap-1.5">{REASONS.map((r) => <button type="button" key={r} className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-taupe-deep hover:border-gold hover:text-gold-deep" onClick={() => setReason(r)}>{r}</button>)}</div>
          </Section>
        </div>
        <aside className="card h-fit space-y-3 text-sm lg:sticky lg:top-28">
          <p className="card-title">Summary</p>
          <div className="flex justify-between"><span className="text-taupe-deep">On hand now</span><b>{v.stock}</b></div>
          <div className="flex justify-between"><span className="text-taupe-deep">Held</span><b>{v.reserved}</b></div>
          <div className="flex justify-between"><span className="text-taupe-deep">Change</span><b className={d < 0 ? 'text-danger' : d > 0 ? 'text-ok' : ''}>{d > 0 ? '+' : ''}{d}</b></div>
          <div className="flex justify-between border-t border-line pt-3 text-base"><span className="font-medium">On hand after</span><b className={after < v.reserved ? 'text-danger' : ''}>{after}</b></div>
          <Link to={`/inventory/${p.id}/history`} className="link inline-flex items-center gap-1"><History size={14} />View history</Link>
        </aside>
      </div>
    </form>
  )
}

/* ============================== history (page) ============================== */
export function InventoryHistoryPage() {
  const { pid } = useParams()
  const { p, err } = useProduct(pid)
  const [items, setItems] = useState<Movement[] | null>(null)
  const [variant, setVariant] = useState('all')
  const [qErr, setQErr] = useState<string | null>(null)

  useEffect(() => {
    getDocs(query(collection(db, 'inventoryMovements'), where('productId', '==', pid), orderBy('createdAt', 'desc'), limit(100)))
      .then((s) => setItems(s.docs.map((d) => ({ ...(d.data() as Movement), id: d.id })))).catch((e) => setQErr(errMsg(e)))
  }, [pid])

  if (err) return <div>{back}<div className="mt-4"><ErrorBox message={err} /></div></div>
  const rows = (items ?? []).filter((m) => variant === 'all' || m.variantId === variant)
  return (
    <div>
      <PageHeader title="Stock history" subtitle={p?.name} back={back}
        actions={p && <Link to={`/inventory/${p.id}/adjust`} className="btn btn-solid"><SlidersHorizontal size={15} />Adjust stock</Link>} />
      {qErr && <ErrorBox message={qErr} />}
      <DataTable<Movement> columns={histCols} data={rows} loading={!items} perPage={10} defaultSortFieldId="when" empty="No movements recorded."
        filters={p && <select className="field !w-auto" aria-label="Filter by variant" value={variant} onChange={(e) => setVariant(e.target.value)}><option value="all">All variants</option>{p.variants.map((x) => <option key={x.id} value={x.id}>{vname(x)}</option>)}</select>} />
    </div>
  )
}
