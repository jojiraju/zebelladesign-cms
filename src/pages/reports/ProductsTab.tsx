import { Eye, Heart, ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react'
import type { Analysis } from '../../lib/reports'
import { formatINR } from '../../lib/util'
import { BarChart, Donut, HBars, Stat } from '../../components/Charts'
import { Notice, ReportCard } from '../../components/ReportKit'
import { Cols2, Gap, Grid, Heading, col, colored } from './shared'

export const productSheets = (a: Analysis) => {
  const e = a.engagement, p = a.perf
  type Ev = (typeof e.views)[number]
  const evCols = () => [col('Product', (r: Ev) => r.name, 'text', 34), col('Visits', (r: Ev) => r.view, 'int'), col('Wishlist adds', (r: Ev) => r.wishlist, 'int'), col('Cart adds', (r: Ev) => r.cart, 'int')]
  const wishlist = { name: 'Most wishlisted', rows: e.wishlist, cols: evCols() }
  const cart = { name: 'Most added to cart', rows: e.cart, cols: evCols() }
  const visited = { name: 'Most visited', rows: e.views, cols: evCols() }
  type Pf = (typeof p.best)[number]
  const best = { name: 'Best selling', rows: p.best, cols: [col('Product', (r: Pf) => r.name, 'text', 34), col('Units sold', (r: Pf) => r.qty, 'int'), col('Revenue', (r: Pf) => r.revenue, 'inr')] }
  type Ls = (typeof p.lowSelling)[number]
  const low = { name: 'Low selling', rows: p.lowSelling, cols: [col('Product', (r: Ls) => r.name, 'text', 34), col('Units sold', (r: Ls) => r.qty, 'int'), col('Revenue', (r: Ls) => r.revenue, 'inr'), col('Units in stock', (r: Ls) => r.available, 'int')] }
  type Sz = (typeof p.sizeRows)[number]
  const size = { name: 'Size wise sales', rows: p.sizeRows, cols: [col('Size', (r: Sz) => r.size), col('Units sold', (r: Sz) => r.qty, 'int'), col('Revenue', (r: Sz) => r.revenue, 'inr'), col('Share of units', (r: Sz) => (p.sizeRows.reduce((n, x) => n + x.qty, 0) ? (r.qty / p.sizeRows.reduce((n, x) => n + x.qty, 0)) * 100 : 0), 'pct')] }
  type Cl = (typeof p.colorRows)[number]
  const color = { name: 'Colour wise sales', rows: p.colorRows, cols: [col('Colour', (r: Cl) => r.color), col('Units sold', (r: Cl) => r.qty, 'int'), col('Revenue', (r: Cl) => r.revenue, 'inr'), col('Share of units', (r: Cl) => (p.colorRows.reduce((n, x) => n + x.qty, 0) ? (r.qty / p.colorRows.reduce((n, x) => n + x.qty, 0)) * 100 : 0), 'pct')] }
  return { wishlist, cart, visited, best, low, size, color }
}

export function ProductsTab({ a, eventsOk }: { a: Analysis; eventsOk: boolean }) {
  const e = a.engagement, p = a.perf, s = productSheets(a)
  const top = (rows: typeof e.views, k: 'view' | 'wishlist' | 'cart') => rows.slice(0, 8).map((r) => ({ label: r.name, value: r[k] }))
  const noEvents = !e.any
  return (
    <>
      <Heading sub="Product engagement">What shoppers look at, save and add to cart</Heading>
      {!eventsOk && <Notice tone="warn">Engagement events can&apos;t be read. These three reports need the storefront to record views, wishlist adds and cart adds in a <b>productEvents</b> collection (<code>productId, name, type: view | wishlist | cart, createdAt</code>) and the admin role to be allowed to read it.</Notice>}
      {eventsOk && noEvents && <Notice>No engagement events recorded for this period yet. Reports fill in as soon as the storefront writes to <b>productEvents</b>.</Notice>}
      <Grid cols={3}>
        <Stat index={0} tone="sky" icon={Eye} label="Product visits" value={e.totals.view} hint="Product page views" />
        <Stat index={1} tone="rose" icon={Heart} label="Wishlist adds" value={e.totals.wishlist} hint={`${e.totals.view ? ((e.totals.wishlist / e.totals.view) * 100).toFixed(1) : '0'}% of visits`} />
        <Stat index={2} tone="amber" icon={ShoppingCart} label="Cart adds" value={e.totals.cart} hint={`${e.totals.view ? ((e.totals.cart / e.totals.view) * 100).toFixed(1) : '0'}% of visits`} />
      </Grid>
      <Cols2>
        <ReportCard title="Most visited products" hint="Product page views" sheet={s.visited} rows={6} empty="No visits recorded yet.">
          {e.views.length > 0 && <HBars tone="sky" label="Most visited" format={(v) => `${v}`} data={top(e.views, 'view')} />}
        </ReportCard>
        <ReportCard title="Most wishlisted products" hint="Times added to a wishlist" sheet={s.wishlist} rows={6} empty="No wishlist activity yet.">
          {e.wishlist.length > 0 && <HBars tone="rose" label="Most wishlisted" format={(v) => `${v}`} data={top(e.wishlist, 'wishlist')} />}
        </ReportCard>
      </Cols2>
      <Gap><ReportCard title="Most added to cart" hint="Times added to a cart" sheet={s.cart} rows={6} empty="No cart activity yet.">
        {e.cart.length > 0 && <HBars tone="amber" label="Most added to cart" format={(v) => `${v}`} data={top(e.cart, 'cart')} />}
      </ReportCard></Gap>

      <Heading sub="Product performance">What actually sells</Heading>
      <Grid cols={2}>
        <Stat index={0} tone="emerald" icon={TrendingUp} label="Best seller" value={p.best[0]?.qty ?? 0} hint={p.best[0]?.name ?? 'No sales in this period'} />
        <Stat index={1} tone="violet" icon={TrendingDown} label="Products with no sales" value={p.lowSelling.filter((r) => r.qty === 0).length} hint="Published products, this period" />
      </Grid>
      <Cols2>
        <ReportCard title="Best selling products" hint="By units sold" sheet={s.best} rows={6} empty="No sales in this period.">
          {p.best.length > 0 && <HBars tone="emerald" label="Best selling" format={(v) => `${v} sold`} data={p.best.slice(0, 8).map((r) => ({ label: r.name, value: r.qty, sub: formatINR(r.revenue) }))} />}
        </ReportCard>
        <ReportCard title="Low selling products" hint="Fewest sales first, including products that did not sell" sheet={s.low} rows={6}>
          {p.lowSelling.length > 0 && <HBars tone="rose" label="Low selling" format={(v) => `${v} sold`} data={p.lowSelling.slice(0, 8).map((r) => ({ label: r.name, value: r.qty, sub: `${r.available} in stock` }))} />}
        </ReportCard>
        <ReportCard title="Size wise sales" hint="Units sold per size" sheet={s.size}>
          {p.sizeRows.length > 0 && <BarChart tone="violet" label="Size wise sales" format={(v) => `${v} units`} tick={(l) => l} data={p.sizeRows.map((r) => ({ label: r.size, value: r.qty }))} />}
        </ReportCard>
        <ReportCard title="Colour wise sales" hint="Units sold per colour" sheet={s.color}>
          {p.colorRows.length > 0 && <Donut unit="units" label="Colour wise sales" data={colored(p.colorRows.map((r) => ({ label: r.color, value: r.qty })))} />}
        </ReportCard>
      </Cols2>
    </>
  )
}
