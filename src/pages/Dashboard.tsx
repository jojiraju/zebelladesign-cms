import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, FileText, FolderTree, IndianRupee, Plus, Settings, Shirt, ShoppingBag } from 'lucide-react'
import { db, isConfigured } from '../lib/firebase'
import { useAuth } from '../lib/auth'
import { loadStats, summarise, type DayStat } from '../lib/stats'
import { errMsg, formatINR, fmtDate } from '../lib/util'
import { AreaChart, BarChart, Donut, HBars, Stat } from '../components/Charts'
import { Media } from 'react-data-table-component'
import { DataTable, type TableColumn } from '../components/DataTable'
import { Badge, ErrorBox } from '../components/ui'

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
    if (!isConfigured) {
      setStats([])
      setOrders([])
      setCounts({ products: 0, awaiting: 0 })
      setLow([])
      return
    }
    const jobs: Promise<unknown>[] = []
    if (can('analytics:read')) jobs.push(loadStats(30).then(setStats))
    if (can('orders:read')) {
      jobs.push(getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(200))).then((s) => setOrders(s.docs.map((d) => ({ ...(d.data() as OrderRow), id: d.id })))))
      jobs.push(getCountFromServer(query(collection(db, 'orders'), where('fulfillmentStatus', '==', 'processing'))).then((c) => setCounts((x) => ({ products: x?.products ?? 0, awaiting: c.data().count }))))
    }
    jobs.push(getCountFromServer(collection(db, 'products')).then((c) => setCounts((x) => ({ awaiting: x?.awaiting ?? 0, products: c.data().count }))))
    jobs.push(getDocs(query(collection(db, 'products'), limit(300))).then((s) => setLow(s.docs.map((d) => ({ ...(d.data() as ProductRow), id: d.id })).filter((p) => avail(p) <= p.lowStockThreshold))))
    Promise.all(jobs).catch((e) => setErr(errMsg(e)))
  }, [can])

  const sum = stats ? summarise(stats) : null
  const half = stats ? Math.floor(stats.length / 2) : 0
  const trend = (k: 'revenue' | 'orders') => {
    if (!stats || half < 2) return null
    const prev = stats.slice(0, half).reduce((n, d) => n + (d[k] || 0), 0)
    const cur = stats.slice(half).reduce((n, d) => n + (d[k] || 0), 0)
    return prev ? ((cur - prev) / prev) * 100 : null
  }
  const first = !counts || counts.products === 0
  const name = (user?.displayName || user?.email || '').split(/[@ ]/)[0]

  // Charts always render: with no sales yet they draw a flat ghost series over the last 30 days.
  const series = stats && stats.length ? stats : Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * 864e5); return { day: d.toISOString().slice(0, 10), orders: 0, revenue: 0 } as DayStat })
  const noSales = !sum || sum.orders === 0
  const recent = (orders ?? []).slice(0, 8)
  const statusMix = Object.entries((orders ?? []).reduce<Record<string, number>>((m, o) => { const k = o.fulfillmentStatus || 'processing'; m[k] = (m[k] ?? 0) + 1; return m }, {}))
  const PALETTE = ['#8f3a55', '#c8a46a', '#b9a4b0', '#5a7a5f', '#d9a0a0']
  const donut = statusMix.map(([k, v], i) => ({ label: k.replace(/_/g, ' '), value: v, color: PALETTE[i % PALETTE.length] }))
  const sample = [{ label: 'Processing', value: 3, color: '#8f3a55' }, { label: 'Shipped', value: 2, color: '#c8a46a' }, { label: 'Delivered', value: 4, color: '#5a7a5f' }]
  const placeholders = (names: string[]) => names.map((label) => ({ label, value: 0 }))

  return (
    <div className="flex flex-1 flex-col">
      <section className="hero mb-4">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.32em] text-[#e8cf9e]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-2 text-3xl sm:text-4xl sm:leading-[1.1]">{greeting()}{name ? <>, <em>{name}</em></> : ''}</h1>
            <hr className="hairline mt-3 w-20" />
            <p className="mt-2 max-w-lg text-sm font-light text-white/75">Your season at a glance — the last 30 days of verified sales.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('orders:read') && <Link to="/orders" className="btn btn-glass"><ClipboardList size={15} />View orders</Link>}
            {can('catalog:write') && <Link to="/products/new" className="btn !border-transparent !bg-[#e8cf9e] !text-espresso hover:!bg-[#f1dfb8]"><Plus size={16} />New product</Link>}
          </div>
        </div>
      </section>
      {err && <ErrorBox message={err} />}

      {first && counts && (
        <section className="mb-4" aria-label="Get started">
          <p className="eyebrow mb-2.5">Get started</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { to: '/categories', icon: FolderTree, t: 'Create a category', d: 'Organise your catalogue' },
              { to: '/products/new', icon: Shirt, t: 'Add your first product', d: 'Photos, sizes and stock' },
              { to: '/content', icon: FileText, t: 'Style the homepage', d: 'Hero and brand story' },
              { to: '/settings', icon: Settings, t: 'Store settings', d: 'Shipping, contact, policies' },
            ].map((x, i) => (
              <Link key={x.to} to={x.to} className="step">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-deep"><x.icon size={18} strokeWidth={1.7} /></span>
                <span className="min-w-0"><span className="eyebrow !text-[0.6rem]">Step {i + 1}</span><span className="block font-semibold text-espresso">{x.t}</span><span className="block text-xs text-taupe-deep">{x.d}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sum && <Stat index={0} tone="violet" icon={IndianRupee} label="Revenue" value={sum.revenue} format={formatINR} hint="Last 30 days" spark={series.map((d) => d.revenue)} delta={trend('revenue')} />}
        {sum && <Stat index={1} tone="sky" icon={ShoppingBag} label="Orders" value={sum.orders} hint="Paid, last 30 days" spark={series.map((d) => d.orders)} delta={trend('orders')} />}
        {counts && can('orders:read') && <Stat index={2} tone="amber" icon={ClipboardList} label="Awaiting fulfilment" value={counts.awaiting} hint="Paid, not yet shipped" />}
        {counts && <Stat index={3} tone="emerald" icon={Shirt} label="Products" value={counts.products} hint={`${low.length} low or out of stock`} />}
      </div>

      {sum && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <section className="card">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="card-title">Revenue trend</h2><p className="mt-0.5 text-xs text-taupe-deep">Average order value <b className="text-ink">{formatINR(sum.aov)}</b></p></div>
              <span className="pill">Daily · 30 days</span>
            </div>
            <Ghost on={noSales}><AreaChart tone="violet" label="Daily revenue, last 30 days" data={series.map((s) => ({ label: s.day, value: s.revenue }))} format={formatINR} /></Ghost>
          </section>
          <section className="card">
            <div className="mb-3 flex items-center justify-between"><h2 className="card-title">Order status</h2><span className="pill">Recent</span></div>
            {donut.length ? <Donut label="Orders by fulfilment status" data={donut} /> : <Ghost on note={false}><Donut label="Orders by fulfilment status" data={sample} /></Ghost>}
          </section>
        </div>
      )}

      {sum && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="card">
            <div className="mb-3 flex items-center justify-between"><h2 className="card-title">Orders per day</h2><span className="pill">30 days</span></div>
            <Ghost on={noSales}><BarChart tone="sky" label="Orders per day, last 30 days" data={series.map((s) => ({ label: s.day, value: s.orders }))} format={(v) => `${v} orders`} /></Ghost>
          </section>
          <section className="card">
            <div className="mb-4 flex items-center justify-between"><h2 className="card-title">Sales by category</h2><span className="pill">Revenue</span></div>
            {sum.categories.length
              ? <HBars tone="rose" label="Revenue by category" format={formatINR} data={sum.categories.slice(0, 6).map((c) => ({ label: c.slug.replace(/-/g, ' '), value: c.revenue, sub: `${c.qty} sold` }))} />
              : <Ghost on><HBars tone="rose" label="Revenue by category" format={formatINR} data={placeholders(['Category one', 'Category two', 'Category three', 'Category four'])} /></Ghost>}
          </section>
          <section className="card">
            <div className="mb-4 flex items-center justify-between"><h2 className="card-title">Best sellers</h2><span className="pill">By units</span></div>
            {sum.topProducts.length
              ? <HBars tone="amber" label="Best selling products" format={(v) => `${v} sold`} data={sum.topProducts.slice(0, 6).map((p) => ({ label: p.name, value: p.qty }))} />
              : <Ghost on><HBars tone="amber" label="Best selling products" format={(v) => `${v} sold`} data={placeholders(['Top product', 'Second product', 'Third product', 'Fourth product'])} /></Ghost>}
          </section>
        </div>
      )}

      <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="flex flex-col">
          <div className="mb-3 flex items-center justify-between"><h2 className="card-title">Recent orders</h2><Link to="/orders" className="link inline-flex items-center gap-1 text-sm">View all <ArrowRight size={14} /></Link></div>
          {!can('orders:read') ? <p className="card text-sm text-taupe-deep">Your role cannot view orders.</p>
            : <DataTable columns={orderCols} data={recent} loading={!orders} paginate={false} empty="No orders yet." />}
        </section>

        <section className="card flex flex-col">
          <div className="mb-3 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><AlertTriangle size={16} className="text-champagne" />Low stock</h2><Link to="/inventory" className="link text-sm"><Boxes size={14} className="mr-1 inline" />Inventory</Link></div>
          {low.length === 0 ? <p className="py-6 text-center text-sm text-taupe-deep">Every piece is well stocked.</p> : (
            <ul className="divide-y divide-line text-sm">
              {low.slice(0, 8).map((p) => { const a = avail(p); return <li key={p.id} className="flex items-center justify-between gap-3 py-2.5"><Link className="link truncate" to={`/products/${p.id}`}>{p.name}</Link><Badge tone={a <= 0 ? 'bad' : 'warn'}>{a <= 0 ? 'Sold out' : `${a} left`}</Badge></li> })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

/** Dims its chart and adds a "No sales yet" note while there is no data to plot. */
function Ghost({ on, note = true, children }: { on: boolean; note?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className={on ? 'ghost' : ''}>{children}</div>
      {on && note && <p className="pill absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 !bg-white/90 shadow-sm">No sales yet</p>}
    </div>
  )
}
