import { Crown, Repeat, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react'
import type { Analysis } from '../../lib/reports'
import { formatINR } from '../../lib/util'
import { BarChart, Donut, HBars, Stat } from '../../components/Charts'
import { Notice, ReportCard } from '../../components/ReportKit'
import { Cols2, Gap, Grid, col, colored, pl } from './shared'

export const customerSheets = (a: Analysis) => {
  const c = a.cust
  type Top = (typeof c.top)[number]
  type Cu = (typeof c.active)[number]
  const topSpend = { name: 'Top spending customers', rows: c.top, cols: [col('Customer', (r: Top) => r.name, 'text', 28), col('Email', (r: Top) => r.email, 'text', 32), col('Orders', (r: Top) => r.orders, 'int'), col('Total spent', (r: Top) => r.spent, 'inr'), col('Avg order value', (r: Top) => (r.orders ? Math.round(r.spent / r.orders) : 0), 'inr'), col('Last order', (r: Top) => r.last, 'date', 20)] }
  const base = [col('Customer', (r: Cu) => r.name, 'text', 28), col('Email', (r: Cu) => r.email, 'text', 32), col('Joined', (r: Cu) => r.joined, 'date', 20), col('Last sign-in', (r: Cu) => r.lastSignIn, 'date', 20)]
  const newCust = { name: 'New customers', rows: c.newRows, cols: [...base, col('Orders (period)', (r: Cu) => r.orders, 'int')] }
  const active = { name: 'Active customers', rows: c.active, cols: [...base, col('Orders (period)', (r: Cu) => r.orders, 'int'), col('Spent (period)', (r: Cu) => r.spent, 'inr')] }
  const inactive = { name: 'Inactive customers', rows: c.inactive, cols: [...base, col('Last order', (r: Cu) => r.lastOrder || null, 'date', 20), col('Days since activity', (r: Cu) => Math.floor((Date.now() - Math.max(r.lastSignIn, r.lastOrder, r.joined)) / 864e5), 'int')] }
  const summary = { name: 'Customer summary', rows: [
    ['Total customers', c.total], ['New customers (period)', c.newCount], ['Active customers (period)', c.activeCount], ['Inactive customers (period)', c.inactiveCount],
    ['Buyers (period)', c.buyerCount], ['Repeat buyers (period)', c.repeatCount], ['Repeat purchase rate %', Math.round(c.repeatRate * 10) / 10], ['Retention rate %', c.retentionRate == null ? 'n/a' : Math.round(c.retentionRate * 10) / 10],
  ] as [string, string | number][], cols: [col('Metric', (r: [string, string | number]) => r[0], 'text', 34), col('Value', (r: [string, string | number]) => r[1], 'text', 16)] }
  return { summary, topSpend, newCust, active, inactive }
}

export function CustomersTab({ a, usersOk }: { a: Analysis; usersOk: boolean }) {
  const c = a.cust, s = customerSheets(a)
  return (
    <>
      {!usersOk && <Notice tone="warn">The customer list could not be loaded from the storefront API (check <code>VITE_STOREFRONT_URL</code> and your role). Spend and retention below still come from orders; customer counts need the list.</Notice>}
      <Grid cols={6}>
        <Stat index={0} tone="violet" icon={Users} label="Total customers" value={c.total} hint="Registered accounts" />
        <Stat index={1} tone="emerald" icon={UserPlus} label="New customers" value={c.newCount} hint="Joined this period" />
        <Stat index={2} tone="sky" icon={UserCheck} label="Active" value={c.activeCount} hint="Signed in or ordered" />
        <Stat index={3} tone="amber" icon={UserMinus} label="Inactive" value={c.inactiveCount} hint="No visit or order" />
        <Stat index={4} tone="rose" icon={Repeat} label="Retention rate" value={Math.round((c.retentionRate ?? 0) * 10)} format={(v) => (c.retentionRate == null ? 'n/a' : `${v / 10}%`)} hint={c.retentionRate == null ? 'No earlier buyers yet' : `${c.retained} of ${c.priorBuyers} past buyers returned`} />
        <Stat index={5} tone="violet" icon={Crown} label="Repeat purchase" value={Math.round(c.repeatRate * 10)} format={(v) => `${v / 10}%`} hint={`${c.repeatCount} of ${c.buyerCount} buyers ordered 2+ times`} />
      </Grid>
      <Cols2>
        <section className="card"><h2 className="card-title mb-3">New customers</h2><BarChart tone="emerald" label="New customers" tick={a.tick} format={(v) => `${v} joined`} data={c.newSeries} /></section>
        <section className="card"><h2 className="card-title mb-3">New vs repeat buyers</h2>
          {c.buyerCount ? <Donut unit="buyers" label="New vs repeat buyers" data={colored(c.split)} /> : <p className="py-10 text-center text-sm text-taupe-deep">No purchases in this period.</p>}</section>
      </Cols2>
      <Gap><ReportCard title="Top spending customers" hint="By revenue in this period (verified payments)" sheet={s.topSpend} rows={8} empty="No purchases in this period.">
        {c.top.length > 0 && <HBars tone="violet" label="Top spenders" format={formatINR} data={c.top.slice(0, 8).map((r) => ({ label: r.name, value: r.spent, sub: pl(r.orders, 'order') }))} />}
      </ReportCard></Gap>
      <Gap><ReportCard title="New customers report" hint="Accounts created in this period" sheet={s.newCust} rows={8} empty="Nobody joined in this period." /></Gap>
      <Cols2>
        <ReportCard title="Active customers report" hint="Signed in or placed an order in this period" sheet={s.active} rows={8} empty="No active customers." />
        <ReportCard title="Inactive customers report" hint="No sign-in and no order in this period — good for win-back emails" sheet={s.inactive} rows={8} empty="No inactive customers." />
      </Cols2>
    </>
  )
}
