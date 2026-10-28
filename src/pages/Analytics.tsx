import { useEffect, useState } from 'react'
import { IndianRupee, ShoppingBag, TrendingUp } from 'lucide-react'
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { groupByMonth, loadStats, summarise, type DayStat } from '../lib/stats'
import { errMsg, formatINR } from '../lib/util'
import { AreaChart, BarChart, Donut, Stat } from '../components/Charts'
import { ErrorBox, PageHeader, Spinner } from '../components/ui'

const STATUS_COLORS = ['#a78bfa', '#38bdf8', '#f472b6', '#34d399', '#fb7185', '#fbbf24']
const STATUSES: [string, string][] = [['processing', 'Processing'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['awaiting_payment', 'Awaiting payment']]

export default function Analytics() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<DayStat[] | null>(null)
  const [dist, setDist] = useState<[string, number][]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    loadStats(days).then((s) => live && setStats(s)).catch((e) => live && setErr(errMsg(e)))
    return () => { live = false }
  }, [days])

  useEffect(() => {
    Promise.all(STATUSES.map(async ([k, label]) => [label, (await getCountFromServer(query(collection(db, 'orders'), where('fulfillmentStatus', '==', k)))).data().count] as [string, number]))
      .then(setDist).catch((e) => setErr(errMsg(e)))
  }, [])

  const sum = stats ? summarise(stats) : null
  const total = dist.reduce((n, [, v]) => n + v, 0)

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Revenue counts only payments verified server-side. Refunds are not netted out of these totals."
        actions={<select className="field" aria-label="Period" value={days} onChange={(e) => { setStats(null); setDays(Number(e.target.value)) }}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option></select>} />
      {err && <ErrorBox message={err} />}
      {!sum ? <Spinner /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat index={0} tone="violet" icon={IndianRupee} label="Revenue" value={sum.revenue} format={formatINR} />
            <Stat index={1} tone="sky" icon={ShoppingBag} label="Orders" value={sum.orders} />
            <Stat index={2} tone="emerald" icon={TrendingUp} label="Average order value" value={sum.aov} format={formatINR} hint="Revenue ÷ paid orders" />
          </div>
          <section className="card mt-6"><h2 className="mb-3 card-title">Revenue by day</h2><AreaChart tone="violet" label="Revenue by day" format={formatINR} data={(stats ?? []).map((s) => ({ label: s.day, value: s.revenue }))} /></section>
          <section className="card mt-6"><h2 className="mb-3 card-title">Orders by day</h2><BarChart tone="sky" label="Orders by day" format={(v) => `${v} orders`} data={(stats ?? []).map((s) => ({ label: s.day, value: s.orders }))} /></section>
          {days > 31 && <section className="card mt-6"><h2 className="mb-3 card-title">Revenue by month</h2><BarChart tone="amber" label="Revenue by month" format={formatINR} data={groupByMonth(stats ?? []).map((m) => ({ label: m.label, value: m.revenue }))} /></section>}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="card"><h2 className="mb-3 card-title">Best-selling products</h2>
              {sum.topProducts.length === 0 ? <p className="text-sm text-taupe-deep">No sales in this period.</p> : <ol className="space-y-2 text-sm">{sum.topProducts.map((p) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="text-taupe-deep">{p.qty} · {formatINR(p.revenue)}</span></li>)}</ol>}</section>
            <section className="card"><h2 className="mb-3 card-title">Category performance</h2>
              {sum.categories.length === 0 ? <p className="text-sm text-taupe-deep">No sales in this period.</p> : <ul className="space-y-2 text-sm">{sum.categories.map((c) => <li key={c.slug} className="flex justify-between"><span className="capitalize">{c.slug.replace(/-/g, ' ')}</span><span className="text-taupe-deep">{c.qty} units · {formatINR(c.revenue)}</span></li>)}</ul>}</section>
          </div>
          <section className="card mt-6"><h2 className="mb-3 card-title">Order status distribution (all time)</h2>
            {total === 0 ? <p className="text-sm text-taupe-deep">No orders yet.</p> : (
              <Donut label="Order status distribution" data={dist.map(([l, v], i) => ({ label: l, value: v, color: STATUS_COLORS[i % STATUS_COLORS.length] }))} />
            )}
          </section>
        </>
      )}
    </div>
  )
}
