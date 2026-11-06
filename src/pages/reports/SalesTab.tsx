import { IndianRupee, Package, ShoppingBag, TrendingUp } from 'lucide-react'
import type { SheetDef } from '../../lib/excel'
import type { Analysis } from '../../lib/reports'
import { formatINR } from '../../lib/util'
import { AreaChart, BarChart, Stat } from '../../components/Charts'
import { ReportCard } from '../../components/ReportKit'
import { Cols2, Gap, Grid, col } from './shared'

type Row = { label: string; orders: number; revenue: number }

export const salesSheets = (a: Analysis) => {
  const rows: Row[] = a.overview.revenueSeries.map((r, i) => ({ label: r.label, revenue: r.value, orders: a.overview.orderSeries[i]?.value ?? 0 }))
  const header = a.range.gran === 'hour' ? 'Hour' : a.range.gran === 'month' ? 'Month' : 'Date'
  const byPeriod: SheetDef<Row> = { name: 'Sales by period', rows, cols: [col(header, (r: Row) => r.label), col('Orders', (r: Row) => r.orders, 'int'), col('Revenue', (r: Row) => r.revenue, 'inr'), col('Avg order value', (r: Row) => (r.orders ? Math.round(r.revenue / r.orders) : 0), 'inr')] }
  return { byPeriod }
}

export function SalesTab({ a }: { a: Analysis }) {
  const o = a.overview, s = salesSheets(a)
  return (
    <>
      <Grid>
        <Stat index={0} tone="violet" icon={IndianRupee} label="Revenue" value={o.revenue} format={formatINR} hint="Verified payments" />
        <Stat index={1} tone="sky" icon={ShoppingBag} label="Orders" value={o.orders} hint={`${o.totalOrders} placed in total`} />
        <Stat index={2} tone="emerald" icon={TrendingUp} label="Avg order value" value={o.aov} format={formatINR} hint="Revenue ÷ paid orders" />
        <Stat index={3} tone="amber" icon={Package} label="Units sold" value={o.units} hint={`${formatINR(o.discount)} in discounts`} />
      </Grid>
      <Gap><ReportCard title="Sales by period" hint="Revenue counts only verified payments; cancelled orders are excluded." sheet={s.byPeriod} rows={10}>
        <AreaChart tone="violet" label="Revenue" format={formatINR} tick={a.tick} data={o.revenueSeries} />
      </ReportCard></Gap>
      <Cols2>
        <section className="card"><h2 className="card-title mb-3">Orders per period</h2><BarChart tone="sky" label="Orders" tick={a.tick} format={(v) => `${v} orders`} data={o.orderSeries} /></section>
        <section className="card"><h2 className="card-title mb-3">Average order value</h2><AreaChart tone="amber" label="Average order value" tick={a.tick} format={formatINR} data={o.revenueSeries.map((r, i) => ({ label: r.label, value: (o.orderSeries[i]?.value ?? 0) ? Math.round(r.value / o.orderSeries[i].value) : 0 }))} /></section>
      </Cols2>
    </>
  )
}
