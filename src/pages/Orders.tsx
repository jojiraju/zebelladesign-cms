import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { errMsg, fmtDate, formatINR } from '../lib/util'
import { Check } from 'lucide-react'
import { Badge, ErrorBox, Field, PageHeader, Spinner, Tabs, useToast } from '../components/ui'
import { DataTable, type TableColumn } from '../components/DataTable'

export interface OrderItem { productId: string; variantId: string; name: string; sku: string; image?: string; size?: string; color?: string; quantity: number; unitPrice: number; lineTotal: number }
export interface Order {
  id: string; userId: string; email: string; phone: string
  shippingAddress: { fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string }
  items: OrderItem[]; subtotal: number; discount: number; couponCode?: string; shipping: number; taxIncluded: number; total: number
  paymentMode: 'test' | 'live'; paymentStatus: string; fulfillmentStatus: string
  providerOrderId?: string; providerPaymentId?: string; paidAt?: number | null
  tracking?: { carrier: string; trackingNumber: string; url?: string; shippedAt: number }
  refund?: { id: string; amount: number; status: string; at: number; reason?: string }
  notes?: { text: string; by: string; at: number }[]; isDemo?: boolean; cancelReason?: string; createdAt: number
}

// Mirrors the server's transition table (the server is authoritative and re-validates).
const NEXT: Record<string, string[]> = {
  awaiting_payment: ['cancelled'], processing: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [],
}
const payTone = (s: string) => (s === 'paid' ? 'ok' : s === 'failed' || s === 'refund_pending' ? 'bad' : s === 'refunded' ? 'neutral' : 'warn') as 'ok' | 'bad' | 'neutral' | 'warn'
const label = (s: string) => s.replace(/_/g, ' ')

const STEPS = ['awaiting_payment', 'processing', 'packed', 'shipped', 'delivered']

function Stepper({ status }: { status: string }) {
  if (status === 'cancelled') return <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">This order was cancelled.</p>
  const at = STEPS.indexOf(status)
  return (
    <ol className="card mb-6 flex items-center !py-5" aria-label="Fulfilment progress">
      {STEPS.map((st, i) => (
        <li key={st} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span className={`stepper-dot grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${i < at ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white' : i === at ? 'bg-gradient-to-br from-pink-500 to-violet-600 text-white ring-4 ring-pink-200' : 'bg-stone-100 text-taupe'}`}>{i < at ? <Check size={15} /> : i + 1}</span>
            <span className={`text-[0.7rem] font-medium capitalize ${i <= at ? 'text-ink' : 'text-taupe'}`}>{label(st)}</span>
          </div>
          {i < STEPS.length - 1 && <span className={`mx-2 mb-5 h-0.5 flex-1 rounded ${i < at ? 'bg-emerald-400' : 'bg-stone-200'}`} />}
        </li>
      ))}
    </ol>
  )
}

export function OrdersPage() {
  const [max, setMax] = useState(100)
  const [rows, setRows] = useState<Order[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const nav = useNavigate()
  const [pay, setPay] = useState('all')
  const [ful, setFul] = useState('all')

  useEffect(() => {
    let live = true
    const cs = [orderBy('createdAt', 'desc'), limit(max)]
    getDocs(query(collection(db, 'orders'), ...cs))
      .then((s) => live && setRows(s.docs.map((d) => ({ ...(d.data() as Order), id: d.id }))))
      .catch((e) => live && setErr(errMsg(e)))
    return () => { live = false }
  }, [max])

  const filtered = useMemo(() => (rows ?? []).filter((o) => (pay === 'all' || o.paymentStatus === pay) && (ful === 'all' || o.fulfillmentStatus === ful)), [rows, pay, ful])

  const columns: TableColumn<Order>[] = [
    { id: 'id', name: 'Order', sortable: true, selector: (o) => o.id, grow: 1.6, minWidth: '170px', cell: (o) => <span className="flex flex-wrap items-center gap-1.5"><Link className="link" to={`/orders/${o.id}`}>{o.id}</Link>{o.isDemo && <Badge>demo</Badge>}{o.paymentMode === 'test' && <Badge tone="warn">test</Badge>}</span> },
    { id: 'placed', name: 'Placed', sortable: true, selector: (o) => o.createdAt, grow: 1.3, minWidth: '160px', cell: (o) => <span className="text-taupe-deep">{fmtDate(o.createdAt)}</span> },
    { id: 'customer', name: 'Customer', sortable: true, selector: (o) => o.shippingAddress?.fullName ?? '', grow: 1.6, minWidth: '180px', cell: (o) => <div className="min-w-0"><p className="truncate font-medium">{o.shippingAddress?.fullName}</p><p className="truncate text-xs text-taupe-deep">{o.email}</p></div> },
    { id: 'payment', name: 'Payment', sortable: true, selector: (o) => o.paymentStatus, minWidth: '130px', cell: (o) => <Badge tone={payTone(o.paymentStatus)}>{label(o.paymentStatus)}</Badge> },
    { id: 'fulfilment', name: 'Fulfilment', sortable: true, selector: (o) => o.fulfillmentStatus, minWidth: '130px', cell: (o) => <Badge tone={o.fulfillmentStatus === 'delivered' ? 'ok' : o.fulfillmentStatus === 'cancelled' ? 'bad' : 'brand'}>{label(o.fulfillmentStatus)}</Badge> },
    { id: 'total', name: 'Total', sortable: true, right: true, selector: (o) => o.total, minWidth: '110px', cell: (o) => <b>{formatINR(o.total)}</b> },
  ]

  return (
    <div>
      <PageHeader title="Orders" subtitle="Newest first. Search covers the loaded orders." />
      {err && <ErrorBox message={err} />}
      <Tabs value={ful} onChange={setFul} items={[{ value: 'all', label: 'All', count: rows?.length }, ...Object.keys(NEXT).map((k) => ({ value: k, label: label(k)[0].toUpperCase() + label(k).slice(1), count: (rows ?? []).filter((o) => o.fulfillmentStatus === k).length }))]} />
      <DataTable columns={columns} data={filtered} loading={!rows} defaultSortFieldId="placed" defaultSortAsc={false}
        searchPlaceholder="Search order ID, email or name" searchText={(o) => `${o.id} ${o.email} ${o.shippingAddress?.fullName}`}
        onRowClicked={(o) => nav(`/orders/${o.id}`)}
        empty={rows?.length ? 'No orders match these filters.' : 'Orders appear here after customers check out.'}
        filters={<>
          <select className="field !w-auto" aria-label="Payment status" value={pay} onChange={(e) => setPay(e.target.value)}>
            <option value="all">All payments</option>{['created', 'pending', 'paid', 'failed', 'refund_pending', 'refunded'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </>} />
      {rows && rows.length >= max && <div className="mt-4 text-center"><button className="btn" onClick={() => setMax(max + 100)}>Load more orders</button></div>}
    </div>
  )
}

export function OrderDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const [o, setO] = useState<Order | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [track, setTrack] = useState({ carrier: '', trackingNumber: '', url: '' })
  const [note, setNote] = useState('')
  const [refundAmt, setRefundAmt] = useState('')
  const [reason, setReason] = useState('')

  const load = () => getDoc(doc(db, 'orders', id!)).then((s) => (s.exists() ? setO({ ...(s.data() as Order), id: s.id }) : setErr('Order not found.'))).catch((e) => setErr(errMsg(e)))
  useEffect(() => { void load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act<T>(fn: () => Promise<T>, ok: string) {
    setBusy(true)
    try { await fn(); toast(ok); await load() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  if (err) return <ErrorBox message={err} />
  if (!o) return <Spinner />
  const a = o.shippingAddress
  const fulfil = can('orders:fulfil')
  const paid = o.paymentStatus === 'paid'

  return (
    <div>
      <PageHeader sticky title={o.id} subtitle={`Placed ${fmtDate(o.createdAt)}`} actions={<Link to="/orders" className="btn">← Back</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone={payTone(o.paymentStatus)}>payment: {label(o.paymentStatus)}</Badge>
        <Badge>fulfilment: {label(o.fulfillmentStatus)}</Badge>
        {o.paymentMode === 'test' && <Badge tone="warn">TEST payment</Badge>}{o.isDemo && <Badge>demo data</Badge>}
      </div>
      <Stepper status={o.fulfillmentStatus} />
      {o.paymentStatus === 'refund_pending' && <p className="mb-4 rounded-xl border border-danger/25 bg-red-50 p-3 text-sm text-danger">This order needs a refund{o.cancelReason ? ` (${label(o.cancelReason)})` : ''}. Issue it below — the status only changes once Razorpay confirms.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="card">
            <h2 className="card-title mb-3">Items</h2>
            <ul className="divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.productId + i.variantId} className="flex items-center gap-3 py-3 text-sm">
                  {i.image && <img src={i.image} alt="" className="h-16 w-12 object-cover" />}
                  <div className="flex-1"><b>{i.name}</b><div className="text-xs text-taupe-deep">{i.sku} · {[i.size, i.color].filter(Boolean).join(' / ')} · {formatINR(i.unitPrice)} × {i.quantity}</div></div>
                  <b>{formatINR(i.lineTotal)}</b>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(o.subtotal)}</dd></div>
              {o.discount > 0 && <div className="flex justify-between"><dt>Discount {o.couponCode && `(${o.couponCode})`}</dt><dd>−{formatINR(o.discount)}</dd></div>}
              <div className="flex justify-between"><dt>Shipping</dt><dd>{formatINR(o.shipping)}</dd></div>
              <div className="flex justify-between"><dt>GST included</dt><dd>{formatINR(o.taxIncluded)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-serif text-xl font-bold"><dt>Total</dt><dd>{formatINR(o.total)}</dd></div>
            </dl>
          </section>

          <section className="card">
            <h2 className="card-title mb-3">Internal notes</h2>
            <ul className="mb-3 space-y-2 text-sm">{(o.notes ?? []).map((n, i) => <li key={i} className="border-l-2 border-gold pl-3">{n.text}<div className="text-xs text-taupe-deep">{n.by} · {fmtDate(n.at)}</div></li>)}{!o.notes?.length && <li className="text-taupe-deep">No notes.</li>}</ul>
            {fulfil && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) void act(() => api(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'note', text: note }) }).then(() => setNote('')), 'Note added') }}>
              <input className="field" aria-label="Add a note" placeholder="Add an internal note" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn" disabled={busy}>Add</button></form>}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card text-sm leading-6">
            <h2 className="card-title mb-2">Customer</h2>
            <p>{a.fullName}</p><p>{o.email}</p><p>{o.phone}</p>
            <p className="mt-2">{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.pincode}</p>
          </section>

          <section className="card text-sm">
            <h2 className="card-title mb-2">Payment</h2>
            <p>Razorpay order: <code className="break-all">{o.providerOrderId ?? '—'}</code></p>
            <p>Payment id: <code className="break-all">{o.providerPaymentId ?? '—'}</code></p>
            <p>Paid at: {fmtDate(o.paidAt)}</p>
            {o.refund && <p className="mt-2">Refunded so far: <b>{formatINR(o.refund.amount)}</b> ({o.refund.status})</p>}
            {can('orders:refund') && (paid || o.paymentStatus === 'refund_pending') && (
              <form className="mt-4 space-y-2 border-t border-line pt-4" onSubmit={(e) => {
                e.preventDefault()
                const amount = Math.round(Number(refundAmt || o.total / 100) * 100)
                if (!window.confirm(`Refund ${formatINR(amount)} to the customer via Razorpay? This cannot be undone.`)) return
                void act(() => api(`/api/admin/orders/${o.id}/refund`, { method: 'POST', body: JSON.stringify({ amount, reason }) }), 'Refund submitted')
              }}>
                <Field label="Refund amount (₹)" hint="Defaults to the full order total. The server checks it against Razorpay."><input type="number" step="0.01" min="0" className="field" placeholder={String(o.total / 100)} value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} /></Field>
                <Field label="Reason"><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                <button className="btn btn-danger" disabled={busy}>Issue refund</button>
              </form>
            )}
          </section>

          <section className="card text-sm">
            <h2 className="card-title mb-2">Fulfilment</h2>
            {o.tracking && <p className="mb-3">{o.tracking.carrier} · <b>{o.tracking.trackingNumber}</b> {o.tracking.url && <a className="link" href={o.tracking.url} target="_blank" rel="noreferrer">link</a>}</p>}
            {fulfil && (NEXT[o.fulfillmentStatus] ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {NEXT[o.fulfillmentStatus].filter((s) => s === 'cancelled' || paid).map((s) => (
                  <button key={s} className={`btn btn-sm ${s === 'cancelled' ? 'btn-danger' : ''}`} disabled={busy}
                    onClick={() => { if (s === 'cancelled' && !window.confirm('Cancel this order? Stock is restored; a paid order will then need a refund.')) return; void act(() => api(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'status', status: s }) }), `Marked ${label(s)}`) }}>
                    Mark {label(s)}
                  </button>
                ))}
              </div>
            )}
            {fulfil && paid && o.fulfillmentStatus !== 'cancelled' && (
              <form className="mt-4 space-y-2 border-t border-line pt-4" onSubmit={(e) => { e.preventDefault(); void act(() => api(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'tracking', ...track }) }), 'Tracking saved (customer emailed if email is configured)') }}>
                <Field label="Carrier"><input className="field" required value={track.carrier} onChange={(e) => setTrack({ ...track, carrier: e.target.value })} /></Field>
                <Field label="Tracking number"><input className="field" required value={track.trackingNumber} onChange={(e) => setTrack({ ...track, trackingNumber: e.target.value })} /></Field>
                <Field label="Tracking URL (optional)"><input type="url" className="field" value={track.url} onChange={(e) => setTrack({ ...track, url: e.target.value })} /></Field>
                <button className="btn" disabled={busy}>Save tracking</button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

