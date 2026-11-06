import { useMemo, useState } from 'react'
import { BarChart3, Boxes, ClipboardList, MapPin, Shirt, Users } from 'lucide-react'
import { analyse, resolveRange, ymd, useReportData, type RangeSel } from '../lib/reports'
import { ErrorBox, PageHeader, Spinner } from '../components/ui'
import { DateRangeBar, ExportButton, Notice, ReportCtx } from '../components/ReportKit'
import { SalesTab, salesSheets } from './reports/SalesTab'
import { ProductsTab, productSheets } from './reports/ProductsTab'
import { CustomersTab, customerSheets } from './reports/CustomersTab'
import { LocationTab, locationSheets } from './reports/LocationTab'
import { InventoryTab, inventorySheets } from './reports/InventoryTab'
import { OrdersTab, orderSheets } from './reports/OrdersTab'

const TABS = [
  { id: 'sales', label: 'Sales', icon: BarChart3 },
  { id: 'products', label: 'Products', icon: Shirt },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'location', label: 'Location & delivery', icon: MapPin },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'orders', label: 'Orders & payments', icon: ClipboardList },
] as const
type TabId = (typeof TABS)[number]['id']

export default function Analytics() {
  const [tab, setTab] = useState<TabId>('sales')
  const [sel, setSel] = useState<RangeSel>(() => ({ preset: 'month', from: ymd(Date.now() - 29 * 864e5), to: ymd(Date.now()) }))
  const { data, error, loading } = useReportData(sel)
  const a = useMemo(() => (data ? analyse(data) : null), [data])
  const range = useMemo(() => resolveRange(sel), [sel])
  const tabLabel = TABS.find((t) => t.id === tab)!.label

  const sheets = !a ? [] : tab === 'sales' ? Object.values(salesSheets(a)) : tab === 'products' ? Object.values(productSheets(a)) : tab === 'customers' ? Object.values(customerSheets(a))
    : tab === 'location' ? Object.values(locationSheets(a)) : tab === 'inventory' ? Object.values(inventorySheets(a)) : Object.values(orderSheets(a))

  return (
    <ReportCtx.Provider value={{ range, scope: tabLabel }}>
      <PageHeader title="Reports & analytics" subtitle="Filter by day, week, month, year or any custom range — every report can be downloaded as Excel." />
      <DateRangeBar sel={sel} onChange={setSel} range={range} right={a && <ExportButton solid title="All reports" label={`Export ${tabLabel.toLowerCase()} (Excel)`} sheets={sheets} />} />

      <div role="tablist" aria-label="Report sections" className="mb-5 flex flex-wrap gap-1.5 rounded-2xl border border-white/80 bg-white/70 p-1.5 shadow-[var(--shadow-card)] backdrop-blur">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${tab === t.id ? 'bg-espresso text-[#f3e3c3] shadow-md' : 'text-taupe-deep hover:bg-gold-soft hover:text-gold-deep'}`}>
            <t.icon size={15} strokeWidth={1.8} />{t.label}
          </button>
        ))}
      </div>

      {data?.sample && <Notice>These reports are running on the built-in <b>demo data</b> (about 800 days of sample orders, customers and stock), so you can explore every chart and Excel download.</Notice>}
      {data?.truncated && <Notice tone="warn">This range has more than 10,000 orders, so older ones are left out. Narrow the date range for exact figures.</Notice>}
      {error && <ErrorBox message={error} />}
      {loading && !a ? <Spinner /> : a && (
        <div className={loading ? 'pointer-events-none opacity-60 transition' : 'transition'}>
          {tab === 'sales' && <SalesTab a={a} />}
          {tab === 'products' && <ProductsTab a={a} eventsOk={data!.eventsOk} />}
          {tab === 'customers' && <CustomersTab a={a} usersOk={data!.usersOk} />}
          {tab === 'location' && <LocationTab a={a} />}
          {tab === 'inventory' && <InventoryTab a={a} />}
          {tab === 'orders' && <OrdersTab a={a} />}
          <p className="mt-6 text-xs text-taupe-deep">Revenue counts verified payments only; cancelled and refunded orders are excluded. Refunds are not netted against totals.</p>
        </div>
      )}
    </ReportCtx.Provider>
  )
}
