import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, IndianRupee, Plus, Shirt, ShoppingBag } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../lib/auth'
import { loadStats, summarise, type DayStat } from '../lib/stats'
import { errMsg, formatINR, fmtDate } from '../lib/util'
import { AreaChart, BarChart, Stat, TONE_COLORS } from '../components/Charts'
import { Media } from 'react-data-table-component'
import { DataTable, type TableColumn } from '../components/DataTable'
import { Badge, ErrorBox, Spinner } from '../components/ui'

interface OrderRow { id: string; email: string; total: number; paymentStatus: string; fulfillmentStatus: string; createdAt: number; isDemo?: boolean }
interface ProductRow { id: string; name: string; lowStockThreshold: number; variants: { stock: number; reserved: number }[] }

const avail = (p: ProductRow) => (p.variants ?? []).reduce((n, v) => n + v.stock - v.reserved, 0)

const orderCols: TableColumn<OrderRow>[] = [
  { name: 'Order', grow: 1.4, cell: (o) => <Link to={`/orders/${o.id}`} className="link">{o.id}{o.isDemo && ' (demo)'}</Link> },
  { name: 'Date', grow: 1.3, cell: (o) => <span className="text-taupe-deep">{fmtDate(o.createdAt)}</span>, hide: Media.MD },
  { name: 'Payment', cell: (o) => <Badge tone={o.paymentStatus === 'paid' ? 'ok' : o.paymentStatus === 'failed' ? 'bad' : 'warn'}>{o.paymentStatus.replace(/_/g, ' ')}</Badge> },
  { name: 'Total', right: true, cell: (o) => <b>{formatINR(o.total)}</b> },
]

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

export default function Dashboard() {
  const { can, user } = useAuth()
  const [stats, setStats] = useState<DayStat[] | null>(null)
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [counts, setCounts] = useState<{ products: number; awaiting: number } | null>(null)
  const [low, setLow] = useState<ProductRow[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const jobs: Promise<unknown>[] = []
    if (can('analytics:read')) jobs.push(loadStats(30).then(setStats))
    if (can('orders:read')) {
      jobs.push(getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(8))).then((s) => setOrders(s.docs.map((d) => ({ ...(d.data() as OrderRow), id: d.id })))))
      jobs.push(getCountFromServer(query(collection(db, 'orders'), where('fulfillmentStatus', '==', 'processing'))).then((c) => setCounts((x) => ({ products: x?.products ?? 0, awaiting: c.data().count }))))
    }
    jobs.push(getCountFromServer(collection(db, 'products')).then((c) => setCounts((x) => ({ awaiting: x?.awaiting ?? 0, products: c.data().count }))))
    jobs.push(getDocs(query(collection(db, 'products'), limit(300))).then((s) => setLow(s.docs.map((d) => ({ ...(d.data() as ProductRow), id: d.id })).filter((p) => avail(p) <= p.lowStockThreshold))))
    Promise.all(jobs).catch((e) => setErr(errMsg(e)))
  }, [can])

  const sum = stats ? summarise(stats) : null
  const first = !counts || counts.products === 0
  const name = (user?.displayName || user?.email || '').split(/[@ ]/)[0]

  return (
    <div>
      <section className="hero mb-6">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-1.5 text-3xl font-extrabold sm:text-4xl">{greeting()}{name ? `, ${name}` : ''} 👋</h1>
            <p className="mt-2 max-w-lg text-sm text-white/80">Here is how the store performed over the last 30 days (verified payments only).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('orders:read') && <Link to="/orders" className="btn btn-glass"><ClipboardList size={15} />View orders</Link>}
            {can('catalog:write') && <Link to="/products/new" className="btn bg-white !text-gold-deep hover:!bg-white/90"><Plus size={16} />New product</Link>}
          </div>
        </div>
      </section>
      {err && <ErrorBox message={err} />}

      {first && counts && (
        <section className="card mb-6 border-gold/40 bg-gradient-to-br from-gold-soft to-white" aria-labelledby="setup">
          <h2 id="setup" className="card-title">Welcome — let&apos;s set up your store</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li><Link className="link" to="/categories">Create a category</Link></li>
            <li><Link className="link" to="/products/new">Add your first product</Link> with photography, sizes and stock</li>
            <li><Link className="link" to="/content">Edit the homepage hero and brand story</Link></li>
            <li><Link className="link" to="/settings">Add shipping, contact details and policies</Link></li>
          </ol>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sum && <Stat index={0} tone="violet" icon={IndianRupee} label="Revenue" value={sum.revenue} format={formatINR} hint="Verified payments, last 30 days" />}
        {sum && <Stat index={1} tone="sky" icon={ShoppingBag} label="Orders" value={sum.orders} hint="Paid orders, last 30 days" />}
        {counts && can('orders:read') && <Stat index={2} tone="amber" icon={ClipboardList} label="Awaiting fulfilment" value={counts.awaiting} hint="Paid, not yet shipped" />}
        {counts && <Stat index={3} tone="emerald" icon={Shirt} label="Products" value={counts.products} hint={`${low.length} low or out of stock`} />}
      </div>

      {sum && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <section className="card">
            <div className="mb-3 flex items-center justify-between"><h2 className="card-title">Revenue trend</h2><span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">Daily · 30 days</span></div>
            <AreaChart tone="violet" label="Daily revenue, last 30 days" data={(stats ?? []).map((s) => ({ label: s.day, value: s.revenue }))} format={formatINR} />
          </section>
          <section className="card">
            <div className="mb-3 flex items-center justify-between"><h2 className="card-title">Orders per day</h2><span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">30 days</span></div>
            <BarChart tone="sky" label="Orders per day, last 30 days" data={(stats ?? []).map((s) => ({ label: s.day, value: s.orders }))} format={(v) => `${v} orders`} />
          </section>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="card-title">Recent orders</h2><Link to="/orders" className="link inline-flex items-center gap-1 text-sm">View all <ArrowRight size={14} /></Link></div>
          {!can('orders:read') ? <p className="card text-sm text-taupe-deep">Your role cannot view orders.</p>
            : <DataTable columns={orderCols} data={orders ?? []} loading={!orders} paginate={false} empty="No orders yet." />}
        </section>

        <div className="space-y-6">
          <section className="card">
            <h2 className="card-title mb-3">Best sellers</h2>
            {!sum ? (stats === null && can('analytics:read') ? <Spinner /> : <p className="text-sm text-taupe-deep">Not available for your role.</p>) : sum.topProducts.length === 0 ? <p className="text-sm text-taupe-deep">No sales yet.</p> : (
              <ol className="space-y-3">
                {sum.topProducts.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${TONE_COLORS[(["rose", "violet", "sky", "emerald", "amber"] as const)[i % 5]].join(", ")})` }}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="text-right text-xs text-taupe-deep">{p.qty} sold<br /><b className="text-sm text-ink">{formatINR(p.revenue)}</b></span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {low.length > 0 && (
            <section className="card">
              <div className="mb-3 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" />Low stock</h2><Link to="/inventory" className="link text-sm"><Boxes size={14} className="mr-1 inline" />Inventory</Link></div>
              <ul className="divide-y divide-line text-sm">
                {low.slice(0, 6).map((p) => { const a = avail(p); return <li key={p.id} className="flex items-center justify-between gap-3 py-2"><Link className="link truncate" to={`/products/${p.id}`}>{p.name}</Link><Badge tone={a <= 0 ? 'bad' : 'warn'}>{a <= 0 ? 'Sold out' : `${a} left`}</Badge></li> })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
