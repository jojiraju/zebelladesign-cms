import { Clock, MapPin, Truck, TriangleAlert } from 'lucide-react'
import type { Analysis } from '../../lib/reports'
import { formatINR } from '../../lib/util'
import { BarChart, Donut, HBars, Stat } from '../../components/Charts'
import { ReportCard } from '../../components/ReportKit'
import { Cols2, Gap, Grid, Heading, col, colored, compactINR, pl } from './shared'

export const locationSheets = (a: Analysis) => {
  const l = a.location, d = a.delivery
  type St = (typeof l.states)[number]
  type Di = (typeof l.districts)[number]
  const states = { name: 'State wise sales', rows: l.states, cols: [col('State', (r: St) => r.state, 'text', 22), col('Orders', (r: St) => r.orders, 'int'), col('Units', (r: St) => r.units, 'int'), col('Revenue', (r: St) => r.revenue, 'inr'), col('Share of revenue', (r: St) => r.share, 'pct')] }
  const districts = { name: 'District wise sales', rows: l.districts, cols: [col('District / city', (r: Di) => r.city, 'text', 24), col('State', (r: Di) => r.state, 'text', 20), col('Orders', (r: Di) => r.orders, 'int'), col('Revenue', (r: Di) => r.revenue, 'inr'), col('Share of revenue', (r: Di) => r.share, 'pct')] }
  type Ca = (typeof d.carriers)[number]
  type Ds = (typeof d.byState)[number]
  type Dl = (typeof d.delayed)[number]
  const carriers = { name: 'Courier performance', rows: d.carriers, cols: [col('Courier', (r: Ca) => r.carrier, 'text', 22), col('Shipments', (r: Ca) => r.shipments, 'int'), col('Delivered', (r: Ca) => r.delivered, 'int'), col('Delivered %', (r: Ca) => r.rate, 'pct'), col('Avg dispatch time (hrs)', (r: Ca) => r.avgHrs, 'dec')] }
  const byState = { name: 'Delivery by state', rows: d.byState, cols: [col('State', (r: Ds) => r.state, 'text', 22), col('Shipped or delivered', (r: Ds) => r.shipped, 'int'), col('Delivered', (r: Ds) => r.delivered, 'int'), col('Delivered %', (r: Ds) => r.rate, 'pct')] }
  const delayed = { name: 'Pending dispatch over 48h', rows: d.delayed, cols: [col('Order', (r: Dl) => r.id), col('Customer', (r: Dl) => r.customer, 'text', 26), col('State', (r: Dl) => r.state, 'text', 18), col('Status', (r: Dl) => r.status), col('Placed', (r: Dl) => r.placed, 'date', 20), col('Waiting (hrs)', (r: Dl) => r.waitingHrs, 'int'), col('Order value', (r: Dl) => r.total, 'inr')] }
  return { states, districts, carriers, byState, delayed }
}

export function LocationTab({ a }: { a: Analysis }) {
  const l = a.location, d = a.delivery, s = locationSheets(a)
  return (
    <>
      <Heading sub="Location analytics">Where your customers are</Heading>
      <Grid cols={3}>
        <Stat index={0} tone="violet" icon={MapPin} label="States reached" value={l.states.length} hint={l.states[0] ? `Top: ${l.states[0].state}` : 'No sales in this period'} />
        <Stat index={1} tone="sky" icon={MapPin} label="Cities / districts" value={l.districts.length} hint={l.districts[0] ? `Top: ${l.districts[0].city}` : 'No sales in this period'} />
        <Stat index={2} tone="emerald" icon={Truck} label="Shipped orders" value={d.shipped + d.delivered} hint={`${d.delivered} delivered`} />
      </Grid>
      <Cols2>
        <ReportCard title="State wise sales" hint="Revenue by delivery state" sheet={s.states} rows={7} empty="No sales in this period.">
          {l.states.length > 0 && <HBars tone="violet" label="State wise sales" format={formatINR} data={l.states.slice(0, 8).map((r) => ({ label: r.state, value: r.revenue, sub: pl(r.orders, 'order') }))} />}
        </ReportCard>
        <section className="card">
          <h2 className="card-title mb-3">Share of revenue by state</h2>
          {l.states.length ? <Donut unit="revenue" format={formatINR} center={compactINR(l.states.reduce((n, r) => n + r.revenue, 0))} label="Share of revenue by state" data={colored([...l.states.slice(0, 6).map((r) => ({ label: r.state, value: r.revenue })), ...(l.states.length > 6 ? [{ label: 'Others', value: l.states.slice(6).reduce((n, r) => n + r.revenue, 0) }] : [])])} /> : <p className="py-10 text-center text-sm text-taupe-deep">No sales in this period.</p>}
        </section>
      </Cols2>
      <Gap><ReportCard title="District wise sales" hint="Uses the city on the shipping address — the order form doesn’t store a separate district." sheet={s.districts} rows={8} empty="No sales in this period.">
        {l.districts.length > 0 && <BarChart tone="amber" label="Top cities" tick={(t) => (t.length > 8 ? `${t.slice(0, 7)}…` : t)} format={formatINR} data={l.districts.slice(0, 10).map((r) => ({ label: r.city, value: r.revenue }))} />}
      </ReportCard></Gap>

      <Heading sub="Delivery analytics">How fast orders leave and arrive</Heading>
      <Grid cols={3}>
        <Stat index={0} tone="sky" icon={Clock} label="Avg dispatch time" value={Math.round(d.avgDispatchHrs * 10)} format={(v) => `${v / 10} hrs`} hint="Payment → handed to courier" />
        <Stat index={1} tone="emerald" icon={Truck} label="Delivered" value={d.delivered} hint={`${d.shipped} still in transit`} />
        <Stat index={2} tone="amber" icon={TriangleAlert} label="Waiting over 48h" value={d.delayed.length} hint="Paid but not yet shipped" />
      </Grid>
      <Cols2>
        <ReportCard title="Courier performance" hint="Shipments, delivery rate and dispatch speed" sheet={s.carriers} rows={6} empty="No shipments in this period.">
          {d.carriers.length > 0 && <HBars tone="sky" label="Shipments by courier" format={(v) => pl(v, 'shipment')} data={d.carriers.map((r) => ({ label: r.carrier, value: r.shipments, sub: `${r.rate.toFixed(0)}% delivered` }))} />}
        </ReportCard>
        <ReportCard title="Delivery by state" hint="Share of shipped orders already delivered" sheet={s.byState} rows={6} empty="No shipments in this period.">
          {d.byState.length > 0 && <HBars tone="emerald" label="Delivered by state" format={(v) => `${v.toFixed(0)}%`} data={d.byState.slice(0, 8).map((r) => ({ label: r.state, value: r.rate, sub: `${r.delivered}/${r.shipped}` }))} />}
        </ReportCard>
      </Cols2>
      <Gap><section className="card"><h2 className="card-title mb-3">Shipments dispatched</h2><BarChart tone="sky" label="Shipments dispatched" tick={a.tick} format={(v) => `${v} shipments`} data={d.shipSeries} /></section></Gap>
      <Gap><ReportCard title="Delayed shipments" hint="Paid orders waiting more than 48 hours to ship" sheet={s.delayed} rows={8} empty="Nothing is waiting — every paid order has shipped within 48 hours." /></Gap>
    </>
  )
}
