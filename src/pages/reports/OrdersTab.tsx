import { useState } from 'react'
import { Ban, CheckCircle2, CircleDollarSign, Clock, PackageCheck, Truck, XCircle } from 'lucide-react'
import type { Analysis, ROrder } from '../../lib/reports'
import { STATUS_BUCKETS, statusLabel, titleCase } from '../../lib/reports'
import { formatINR } from '../../lib/util'
import { BarChart, Donut, Stat } from '../../components/Charts'
import { ReportCard } from '../../components/ReportKit'
import { Badge, Tabs } from '../../components/ui'
import { Cols2, Gap, Grid, col, colored } from './shared'

const cust = (o: ROrder) => o.shippingAddress?.fullName || o.email

export const orderCols = [
  col('Order', (o: ROrder) => o.id, 'text', 14), col('Placed', (o: ROrder) => o.createdAt, 'date', 20), col('Customer', (o: ROrder) => cust(o), 'text', 26), col('Email', (o: ROrder) => o.email, 'text', 30),
  col('State', (o: ROrder) => titleCase(o.shippingAddress?.state), 'text', 16), col('Items', (o: ROrder) => o.items.reduce((n, i) => n + i.quantity, 0), 'int'), col('Total', (o: ROrder) => o.total, 'inr'),
  col('Payment', (o: ROrder) => o.paymentStatus.replace(/_/g, ' ')), col('Status', (o: ROrder) => statusLabel(o)),
]

export const orderSheets = (a: Analysis, filter = 'all') => {
  const r = a.ordersReport
  const rows = filter === 'all' ? r.all : r.all.filter(STATUS_BUCKETS.find((b) => b.key === filter)!.match)
  const byStatus = { name: filter === 'all' ? 'All orders' : `${STATUS_BUCKETS.find((b) => b.key === filter)!.label} orders`, rows, cols: orderCols }
  const cancelled = { name: 'Cancelled orders', rows: r.cancelled, cols: [col('Order', (o: ROrder) => o.id, 'text', 14), col('Placed', (o: ROrder) => o.createdAt, 'date', 20), col('Customer', (o: ROrder) => cust(o), 'text', 26), col('Email', (o: ROrder) => o.email, 'text', 30), col('Order value', (o: ROrder) => o.total, 'inr'), col('Payment', (o: ROrder) => o.paymentStatus.replace(/_/g, ' ')), col('Refund', (o: ROrder) => o.refund?.status ?? '—'), col('Reason', (o: ROrder) => o.cancelReason ?? '—', 'text', 28)] }
  const failed = { name: 'Failed payments', rows: r.failed, cols: [col('Order', (o: ROrder) => o.id, 'text', 14), col('Attempted', (o: ROrder) => o.createdAt, 'date', 20), col('Customer', (o: ROrder) => cust(o), 'text', 26), col('Email', (o: ROrder) => o.email, 'text', 30), col('Phone', (o: ROrder) => o.phone ?? '—', 'text', 14), col('Amount', (o: ROrder) => o.total, 'inr'), col('Payment ID', (o: ROrder) => o.providerPaymentId ?? '—', 'text', 22), col('Mode', (o: ROrder) => o.paymentMode ?? '—')] }
  const summary = { name: 'Status summary', rows: r.buckets, cols: [col('Status', (b: (typeof r.buckets)[number]) => b.label), col('Meaning', (b: (typeof r.buckets)[number]) => b.hint, 'text', 26), col('Orders', (b: (typeof r.buckets)[number]) => b.count, 'int'), col('Order value', (b: (typeof r.buckets)[number]) => b.value, 'inr')] }
  return { summary, byStatus, cancelled, failed }
}

const ICONS = { pending: Clock, confirmed: CheckCircle2, processing: PackageCheck, shipped: Truck, delivered: CheckCircle2, cancelled: Ban } as const
const TONES = { pending: 'amber', confirmed: 'sky', processing: 'violet', shipped: 'sky', delivered: 'emerald', cancelled: 'rose' } as const

export function OrdersTab({ a }: { a: Analysis }) {
  const [filter, setFilter] = useState('all')
  const r = a.ordersReport, s = orderSheets(a, filter)
  const statusTone = (st: string) => (st === 'Delivered' ? 'ok' : st === 'Cancelled' ? 'bad' : st === 'Pending' ? 'warn' : 'brand') as 'ok' | 'bad' | 'warn' | 'brand'
  const badge = (c: { header: string }, o: ROrder) => (c.header === 'Status' ? <Badge tone={statusTone(statusLabel(o))}>{statusLabel(o)}</Badge> : c.header === 'Payment' ? <Badge tone={o.paymentStatus === 'paid' ? 'ok' : o.paymentStatus === 'failed' ? 'bad' : 'warn'}>{o.paymentStatus.replace(/_/g, ' ')}</Badge> : undefined)
  return (
    <>
      <Grid cols={6}>
        {r.buckets.map((b, i) => <Stat key={b.key} index={i} tone={TONES[b.key]} icon={ICONS[b.key]} label={b.label} value={b.count} hint={b.hint} />)}
      </Grid>
      <Cols2>
        <section className="card"><h2 className="card-title mb-3">Orders by status</h2>
          {r.all.length ? <Donut label="Orders by status" data={r.buckets.map((b, i) => ({ label: b.label, value: b.count, color: ['#c8a46a', '#b9a4b0', '#8f3a55', '#6e5566', '#5a7a5f', '#a8261c'][i] }))} /> : <p className="py-10 text-center text-sm text-taupe-deep">No orders in this period.</p>}</section>
        <section className="card"><h2 className="card-title mb-3">Payment outcomes</h2>
          {r.all.length ? <Donut unit="orders" label="Payment outcomes" data={colored(r.payMix)} /> : <p className="py-10 text-center text-sm text-taupe-deep">No orders in this period.</p>}</section>
      </Cols2>

      <Gap>
        <Tabs value={filter} onChange={setFilter} items={[{ value: 'all', label: 'All', count: r.all.length }, ...r.buckets.map((b) => ({ value: b.key as string, label: b.label, count: b.count }))]} />
        <ReportCard title={s.byStatus.name} hint="Pending = awaiting payment · Confirmed = paid, not packed · Processing = packed" sheet={s.byStatus} rows={10} badge={badge} empty="No orders match this status in the period." />
      </Gap>

      <div className="mt-4" />
      <Grid cols={4}>
        <Stat index={0} tone="rose" icon={XCircle} label="Cancelled orders" value={r.cancelled.length} hint={`${r.cancelRate.toFixed(1)}% of orders`} />
        <Stat index={1} tone="amber" icon={Ban} label="Cancelled value" value={r.cancelledValue} format={formatINR} hint="Order value lost" />
        <Stat index={2} tone="violet" icon={CircleDollarSign} label="Failed payments" value={r.failed.length} hint={`${r.failRate.toFixed(1)}% of orders`} />
        <Stat index={3} tone="sky" icon={CircleDollarSign} label="Failed payment value" value={r.failedValue} format={formatINR} hint="Potential revenue" />
      </Grid>
      <Cols2>
        <ReportCard title="Cancelled orders report" hint="With the reason and refund status" sheet={s.cancelled} rows={6} badge={badge} empty="No cancelled orders in this period.">
          <BarChart tone="rose" label="Cancelled orders" tick={a.tick} format={(v) => `${v} cancelled`} data={r.cancelledSeries} />
        </ReportCard>
        <ReportCard title="Failed payments report" hint="Customers who tried to pay and couldn’t — follow up to recover the sale" sheet={s.failed} rows={6} badge={badge} empty="No failed payments in this period.">
          <BarChart tone="amber" label="Failed payments" tick={a.tick} format={(v) => `${v} failed`} data={r.failedSeries} />
        </ReportCard>
      </Cols2>
    </>
  )
}
