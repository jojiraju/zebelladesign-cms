import { AlertTriangle, Archive, Boxes, IndianRupee, PackageX, Zap } from 'lucide-react'
import type { Analysis } from '../../lib/reports'
import { formatINR } from '../../lib/util'
import { BarChart, Donut, HBars, Stat } from '../../components/Charts'
import { Matrix, ReportCard } from '../../components/ReportKit'
import { Badge } from '../../components/ui'
import { Cols2, Gap, Grid, Heading, col } from './shared'

export const inventorySheets = (a: Analysis) => {
  const i = a.inventory
  type Pr = (typeof i.products)[number]
  type Va = (typeof i.variants)[number]
  const stockCols = () => [col('Product', (x: Pr) => x.name, 'text', 32), col('SKU', (x: Pr) => x.sku, 'text', 16), col('Category', (x: Pr) => x.category.replace(/-/g, ' '), 'text', 16), col('In stock', (x: Pr) => x.stock, 'int'), col('Reserved', (x: Pr) => x.reserved, 'int'), col('Available', (x: Pr) => x.available, 'int'), col('Stock value', (x: Pr) => x.value, 'inr'), col('Status', (x: Pr) => x.status)]
  const availability = { name: 'Current stock', rows: i.products, cols: stockCols() }
  const vCols = [col('Product', (x: Va) => x.product, 'text', 32), col('SKU', (x: Va) => x.sku, 'text', 20), col('Size', (x: Va) => x.size), col('Colour', (x: Va) => x.color), col('In stock', (x: Va) => x.stock, 'int'), col('Reserved', (x: Va) => x.reserved, 'int'), col('Available', (x: Va) => x.available, 'int'), col('Alert level', (x: Va) => x.threshold, 'int')]
  const low = { name: 'Low stock alert', rows: i.low, cols: vCols }
  const out = { name: 'Out of stock', rows: i.out, cols: vCols.slice(0, 7) }
  const mv = (n: string, rows: Pr[]) => ({ name: n, rows, cols: [col('Product', (x: Pr) => x.name, 'text', 32), col('SKU', (x: Pr) => x.sku, 'text', 16), col('Units sold', (x: Pr) => x.sold, 'int'), col('Available', (x: Pr) => x.available, 'int'), col('Sell-through', (x: Pr) => x.sellThrough, 'pct'), col('Stock value', (x: Pr) => x.value, 'inr')] })
  const fast = mv('Fast moving', i.fast), slow = mv('Slow moving', i.slow), dead = mv('Dead stock', i.dead)
  const sizeColor = { name: 'Size and colour stock', rows: i.variants, cols: [col('Product', (x: Va) => x.product, 'text', 32), col('Size', (x: Va) => x.size), col('Colour', (x: Va) => x.color), col('SKU', (x: Va) => x.sku, 'text', 20), col('In stock', (x: Va) => x.stock, 'int'), col('Reserved', (x: Va) => x.reserved, 'int'), col('Available', (x: Va) => x.available, 'int'), col('Status', (x: Va) => x.status)] }
  return { availability, low, out, fast, slow, dead, sizeColor }
}

const tone = (s: string) => (s === 'Out of stock' ? 'bad' : s === 'Low stock' ? 'warn' : 'ok') as 'bad' | 'warn' | 'ok'

export function InventoryTab({ a }: { a: Analysis }) {
  const i = a.inventory, s = inventorySheets(a)
  const statusBadge = <T,>(c: { header: string }, r: T) => (c.header === 'Status' ? <Badge tone={tone((r as { status: string }).status)}>{(r as { status: string }).status}</Badge> : undefined)
  const since = new Date(i.windowFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return (
    <>
      <Grid cols={6}>
        <Stat index={0} tone="violet" icon={Boxes} label="Units on hand" value={i.units} hint={`${i.available} available to sell`} />
        <Stat index={1} tone="emerald" icon={IndianRupee} label="Stock value" value={i.value} format={formatINR} hint="Available × price" />
        <Stat index={2} tone="amber" icon={AlertTriangle} label="Low stock" value={i.low.length} hint="Size/colour variants" />
        <Stat index={3} tone="rose" icon={PackageX} label="Out of stock" value={i.out.length} hint="Size/colour variants" />
        <Stat index={4} tone="sky" icon={Zap} label="Fast movers" value={i.fast.length} hint={`Sold since ${since}`} />
        <Stat index={5} tone="violet" icon={Archive} label="Dead stock value" value={i.deadValue} format={formatINR} hint={`${i.dead.length} products, no sales`} />
      </Grid>

      <Cols2>
        <section className="card"><h2 className="card-title mb-3">Stock health</h2><Donut unit="variants" label="Stock health" data={[{ label: 'In stock', value: i.mix[0].value, color: '#5a7a5f' }, { label: 'Low stock', value: i.mix[1].value, color: '#c8a46a' }, { label: 'Out of stock', value: i.mix[2].value, color: '#a8261c' }]} /></section>
        <section className="card"><h2 className="card-title mb-3">Units available by size</h2><BarChart tone="violet" label="Units by size" tick={(l) => l} format={(v) => `${v} units`} data={i.sizes} /></section>
      </Cols2>

      <Gap><ReportCard title="Current stock availability" hint="Every product — in stock, reserved and available" sheet={s.availability} rows={8} badge={statusBadge} /></Gap>
      <Cols2>
        <ReportCard title="Low stock alert report" hint="Variants at or below their alert level" sheet={s.low} rows={6} badge={statusBadge} empty="No variants are running low." />
        <ReportCard title="Out of stock report" hint="Variants with nothing left to sell" sheet={s.out} rows={6} badge={statusBadge} empty="Nothing is out of stock." />
      </Cols2>

      <Heading sub="Stock movement">Fast, slow and dead stock</Heading>
      <p className="-mt-1 mb-3 text-xs text-taupe-deep">Based on sales since {since} (the selected period, widened to at least 30 days so short ranges stay meaningful).</p>
      <Cols2>
        <ReportCard title="Fast moving products" hint="Highest units sold" sheet={s.fast} rows={6} empty="No sales in the window.">
          {i.fast.length > 0 && <HBars tone="emerald" label="Fast moving" format={(v) => `${v} sold`} data={i.fast.slice(0, 8).map((r) => ({ label: r.name, value: r.sold }))} />}
        </ReportCard>
        <ReportCard title="Slow moving products" hint="Selling, but with the fewest units" sheet={s.slow} rows={6} empty="No slow movers.">
          {i.slow.length > 0 && <HBars tone="amber" label="Slow moving" format={(v) => `${v} sold`} data={i.slow.slice(0, 8).map((r) => ({ label: r.name, value: r.sold, sub: `${r.available} left` }))} />}
        </ReportCard>
      </Cols2>
      <Gap><ReportCard title="Dead stock report" hint="Stock on the shelf with zero sales in the window (products older than 30 days)" sheet={s.dead} rows={8} empty="No dead stock — everything has sold." /></Gap>

      <Heading sub="Size & colour">Where the stock sits</Heading>
      <ReportCard title="Size and colour wise stock" hint="Available units per size and colour" sheet={s.sizeColor} rows={8}>
        {i.matrix.sizes.length > 0 ? <Matrix sizes={i.matrix.sizes} colors={i.matrix.colors} cell={i.matrix.cell} /> : null}
      </ReportCard>
    </>
  )
}
