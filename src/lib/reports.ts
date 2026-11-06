import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, isDemo } from './firebase'
import { api } from './api'
import { errMsg } from './util'

/* ======================================================= types ======================================================= */
export interface ROrderItem { productId: string; variantId: string; name: string; sku?: string; size?: string; color?: string; quantity: number; unitPrice: number; lineTotal: number }
export interface ROrder {
  id: string; userId?: string; email: string; phone?: string
  shippingAddress?: { fullName?: string; state?: string; city?: string; pincode?: string }
  items: ROrderItem[]; total: number; discount?: number
  paymentStatus: string; fulfillmentStatus: string; paymentMode?: string; providerPaymentId?: string
  paidAt?: number | null; tracking?: { carrier?: string; trackingNumber?: string; shippedAt?: number }
  cancelReason?: string; refund?: { status?: string; amount?: number }; createdAt: number
}
export interface RVariant { id: string; sku?: string; size?: string; color?: string; stock: number; reserved: number }
export interface RProduct { id: string; name: string; sku?: string; categorySlug?: string; price: number; salePrice?: number | null; variants: RVariant[]; lowStockThreshold: number; status?: string; createdAt?: number }
export interface RUser { uid: string; email: string | null; name: string | null; createdAt?: string; lastSignIn?: string; role: string | null }
export interface REvent { productId: string; name?: string; type: 'view' | 'wishlist' | 'cart'; createdAt: number }

export type Preset = 'today' | 'week' | 'month' | 'year' | 'custom'
export interface RangeSel { preset: Preset; from: string; to: string } // custom bounds as yyyy-mm-dd
export interface Range { from: number; to: number; label: string; gran: Gran }
export type Gran = 'hour' | 'day' | 'month'

export const DAY = 864e5
const sod = (d: Date | number) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
const eod = (d: Date | number) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime() }
const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
export const ymd = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const fmtShort = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export function resolveRange(sel: RangeSel): Range {
  const now = new Date()
  let from: number, to: number
  if (sel.preset === 'today') { from = sod(now); to = eod(now) }
  else if (sel.preset === 'week') { const d = new Date(now); const back = (d.getDay() + 6) % 7; d.setDate(d.getDate() - back); from = sod(d); to = eod(from + 6 * DAY) }
  else if (sel.preset === 'month') { from = sod(new Date(now.getFullYear(), now.getMonth(), 1)); to = eod(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
  else if (sel.preset === 'year') { from = sod(new Date(now.getFullYear(), 0, 1)); to = eod(new Date(now.getFullYear(), 11, 31)) }
  else { from = sod(parseDay(sel.from)); to = eod(parseDay(sel.to)); if (to < from) [from, to] = [sod(to), eod(from)] }
  const days = Math.round((to - from) / DAY) + 1
  const gran: Gran = days <= 1 ? 'hour' : days <= 92 ? 'day' : 'month'
  const label = sel.preset === 'today' ? `Today · ${fmtShort(from)}` : sel.preset === 'year' ? `This year · ${new Date(from).getFullYear()}` : `${fmtShort(from)} – ${fmtShort(to)}`
  return { from, to, label, gran }
}

const bucketKey = (ms: number, g: Gran) => {
  const d = new Date(ms)
  if (g === 'hour') return `${String(d.getHours()).padStart(2, '0')}:00`
  if (g === 'month') return ymd(ms).slice(0, 7)
  return ymd(ms)
}
/** Every bucket label between from and min(to, now), so quiet periods still show as zero. */
export function bucketLabels(r: Range): string[] {
  const end = Math.min(r.to, Date.now())
  const out: string[] = []
  if (r.gran === 'hour') { for (let h = 0; h < 24; h++) out.push(`${String(h).padStart(2, '0')}:00`); return out }
  if (r.gran === 'day') { for (let t = r.from; t <= end; t += DAY) out.push(ymd(t)); return out }
  const d = new Date(r.from); d.setDate(1)
  while (d.getTime() <= end) { out.push(ymd(d.getTime()).slice(0, 7)); d.setMonth(d.getMonth() + 1) }
  return out
}
export const tickFor = (g: Gran) => (l: string) => {
  if (g === 'hour') return l
  if (g === 'month') { const [y, m] = l.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short' }) }
  return l.slice(-5)
}

/* ===================================================== loading ====================================================== */
export interface ReportData {
  range: Range; history: ROrder[]; products: RProduct[]; users: RUser[]; events: REvent[]
  usersOk: boolean; eventsOk: boolean; truncated: boolean; sample: boolean
}
const LOOKBACK = 365 * DAY
const ORDER_CAP = 10000

async function loadLive(range: Range): Promise<ReportData> {
  const snap = await getDocs(query(collection(db, 'orders'), where('createdAt', '>=', range.from - LOOKBACK), where('createdAt', '<=', range.to), orderBy('createdAt', 'desc'), limit(ORDER_CAP)))
  const history = snap.docs.map((d) => ({ ...(d.data() as ROrder), id: d.id }))
  const prods = await getDocs(query(collection(db, 'products'), limit(2000)))
  const products = prods.docs.map((d) => ({ ...(d.data() as RProduct), id: d.id }))
  let users: RUser[] = [], usersOk = true
  try { users = (await api<{ users: RUser[] }>('/api/admin/users?q=')).users } catch { usersOk = false }
  let events: REvent[] = [], eventsOk = true
  try {
    const e = await getDocs(query(collection(db, 'productEvents'), where('createdAt', '>=', range.from), where('createdAt', '<=', range.to), orderBy('createdAt', 'desc'), limit(50000)))
    events = e.docs.map((d) => d.data() as REvent)
  } catch { eventsOk = false }
  return { range, history, products, users, events, usersOk, eventsOk, truncated: history.length >= ORDER_CAP, sample: isDemo }
}

export function useReportData(sel: RangeSel) {
  const key = sel.preset === 'custom' ? `${sel.from}|${sel.to}` : sel.preset
  const [state, setState] = useState<{ data: ReportData | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    const range = resolveRange(sel)
    setState((s) => ({ ...s, loading: true, error: null }))
    loadLive(range).then((data) => live && setState({ data, error: null, loading: false })).catch((e) => live && setState({ data: null, error: errMsg(e), loading: false }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}

/* ================================================== calculations ================================================== */
export const isSale = (o: ROrder) => o.paymentStatus === 'paid' && o.fulfillmentStatus !== 'cancelled'
export const titleCase = (s?: string) => ((s ?? '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())) || 'Unknown'
export const available = (v: RVariant) => (v.stock ?? 0) - (v.reserved ?? 0)
const unitPrice = (p: RProduct) => p.salePrice ?? p.price
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0)
const incr = <K,>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by)

export const STATUS_BUCKETS = [
  { key: 'pending', label: 'Pending', hint: 'Awaiting payment', match: (o: ROrder) => o.fulfillmentStatus === 'awaiting_payment' },
  { key: 'confirmed', label: 'Confirmed', hint: 'Paid, not yet packed', match: (o: ROrder) => o.fulfillmentStatus === 'processing' },
  { key: 'processing', label: 'Processing', hint: 'Packed, ready to ship', match: (o: ROrder) => o.fulfillmentStatus === 'packed' },
  { key: 'shipped', label: 'Shipped', hint: 'With the courier', match: (o: ROrder) => o.fulfillmentStatus === 'shipped' },
  { key: 'delivered', label: 'Delivered', hint: 'Completed', match: (o: ROrder) => o.fulfillmentStatus === 'delivered' },
  { key: 'cancelled', label: 'Cancelled', hint: 'Cancelled orders', match: (o: ROrder) => o.fulfillmentStatus === 'cancelled' },
] as const
export const statusLabel = (o: ROrder) => STATUS_BUCKETS.find((b) => b.match(o))?.label ?? o.fulfillmentStatus

export function analyse(d: ReportData) {
  const { range, history, products, users, events } = d
  const orders = history.filter((o) => o.createdAt >= range.from && o.createdAt <= range.to)
  const sales = orders.filter(isSale)
  const labels = bucketLabels(range)
  const series = (list: ROrder[], f: (o: ROrder) => number) => {
    const m = new Map<string, number>(labels.map((l) => [l, 0]))
    for (const o of list) { const k = bucketKey(o.createdAt, range.gran); if (m.has(k)) m.set(k, (m.get(k) ?? 0) + f(o)) }
    return [...m].map(([label, value]) => ({ label, value }))
  }
  const pmap = new Map(products.map((p) => [p.id, p]))

  /* ---- overview ---- */
  const revenue = sales.reduce((n, o) => n + o.total, 0)
  const units = sales.reduce((n, o) => n + o.items.reduce((a, i) => a + i.quantity, 0), 0)
  const overview = { revenue, orders: sales.length, aov: sales.length ? Math.round(revenue / sales.length) : 0, units, discount: sales.reduce((n, o) => n + (o.discount ?? 0), 0), revenueSeries: series(sales, (o) => o.total), orderSeries: series(sales, () => 1), totalOrders: orders.length }

  /* ---- product performance ---- */
  const perf = new Map<string, { id: string; name: string; qty: number; revenue: number }>()
  const bySize = new Map<string, { qty: number; revenue: number }>(), byColor = new Map<string, { qty: number; revenue: number }>()
  for (const o of sales) for (const i of o.items) {
    const p = perf.get(i.productId) ?? { id: i.productId, name: i.name, qty: 0, revenue: 0 }
    p.qty += i.quantity; p.revenue += i.lineTotal; perf.set(i.productId, p)
    for (const [m, k] of [[bySize, (i.size || '—').toUpperCase()], [byColor, titleCase(i.color || '—')]] as [Map<string, { qty: number; revenue: number }>, string][]) {
      const c = m.get(k) ?? { qty: 0, revenue: 0 }; c.qty += i.quantity; c.revenue += i.lineTotal; m.set(k, c)
    }
  }
  const best = [...perf.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
  const live = products.filter((p) => (p.status ?? 'published') === 'published')
  const lowSelling = live.map((p) => ({ id: p.id, name: p.name, qty: perf.get(p.id)?.qty ?? 0, revenue: perf.get(p.id)?.revenue ?? 0, available: p.variants.reduce((n, v) => n + Math.max(0, available(v)), 0) })).sort((a, b) => a.qty - b.qty || b.available - a.available)
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const sizeRows = [...bySize].map(([size, v]) => ({ size, ...v })).sort((a, b) => (sizeOrder.indexOf(a.size) + 1 || 99) - (sizeOrder.indexOf(b.size) + 1 || 99) || a.size.localeCompare(b.size))
  const colorRows = [...byColor].map(([color, v]) => ({ color, ...v })).sort((a, b) => b.qty - a.qty)

  /* ---- engagement ---- */
  const ev = new Map<string, { id: string; name: string; view: number; wishlist: number; cart: number }>()
  for (const e of events) {
    if (e.createdAt < range.from || e.createdAt > range.to) continue
    const row = ev.get(e.productId) ?? { id: e.productId, name: e.name ?? pmap.get(e.productId)?.name ?? e.productId, view: 0, wishlist: 0, cart: 0 }
    row[e.type]++; ev.set(e.productId, row)
  }
  const evRows = [...ev.values()]
  const evTotals = evRows.reduce((t, r) => ({ view: t.view + r.view, wishlist: t.wishlist + r.wishlist, cart: t.cart + r.cart }), { view: 0, wishlist: 0, cart: 0 })
  const rank = (k: 'view' | 'wishlist' | 'cart') => [...evRows].filter((r) => r[k] > 0).sort((a, b) => b[k] - a[k])
  const engagement = { totals: evTotals, views: rank('view'), wishlist: rank('wishlist'), cart: rank('cart'), any: evRows.length > 0 }

  /* ---- customers ---- */
  const customers = users.filter((u) => !u.role)
  const inR = (s?: string) => { const t = s ? Date.parse(s) : NaN; return t >= range.from && t <= range.to }
  const keyOf = (o: ROrder) => (o.userId || o.email || '').toLowerCase()
  const buyers = new Map<string, { key: string; name: string; email: string; orders: number; spent: number; last: number }>()
  for (const o of sales) {
    const k = keyOf(o); if (!k) continue
    const b = buyers.get(k) ?? { key: k, name: o.shippingAddress?.fullName || o.email, email: o.email, orders: 0, spent: 0, last: 0 }
    b.orders++; b.spent += o.total; b.last = Math.max(b.last, o.createdAt); buyers.set(k, b)
  }
  const prior = new Set(history.filter((o) => isSale(o) && o.createdAt < range.from).map(keyOf))
  const retained = [...prior].filter((k) => buyers.has(k))
  const repeat = [...buyers.values()].filter((b) => b.orders >= 2)
  const lastOrderAll = new Map<string, number>()
  for (const o of history.filter(isSale)) { const k = keyOf(o); lastOrderAll.set(k, Math.max(lastOrderAll.get(k) ?? 0, o.createdAt)) }
  const custRow = (u: RUser) => {
    const k1 = u.uid.toLowerCase(), k2 = (u.email ?? '').toLowerCase()
    const b = buyers.get(k1) ?? buyers.get(k2)
    return { name: u.name ?? u.email ?? '—', email: u.email ?? '', joined: u.createdAt ? Date.parse(u.createdAt) : 0, lastSignIn: u.lastSignIn ? Date.parse(u.lastSignIn) : 0, orders: b?.orders ?? 0, spent: b?.spent ?? 0, lastOrder: lastOrderAll.get(k1) ?? lastOrderAll.get(k2) ?? 0 }
  }
  const activeUsers = customers.filter((u) => inR(u.lastSignIn) || buyers.has(u.uid.toLowerCase()) || buyers.has((u.email ?? '').toLowerCase()))
  const activeSet = new Set(activeUsers.map((u) => u.uid))
  const newUsers = customers.filter((u) => inR(u.createdAt))
  const newSeriesMap = new Map<string, number>(labels.map((l) => [l, 0]))
  for (const u of newUsers) { const k = bucketKey(Date.parse(u.createdAt!), range.gran); if (newSeriesMap.has(k)) incr(newSeriesMap, k) }
  const cust = {
    total: customers.length, newCount: newUsers.length, activeCount: activeUsers.length, inactiveCount: customers.length - activeUsers.length,
    top: [...buyers.values()].sort((a, b) => b.spent - a.spent), buyerCount: buyers.size,
    retentionRate: prior.size ? pct(retained.length, prior.size) : null, priorBuyers: prior.size, retained: retained.length,
    repeatRate: buyers.size ? pct(repeat.length, buyers.size) : 0, repeatCount: repeat.length,
    active: activeUsers.map(custRow).sort((a, b) => b.spent - a.spent || b.lastSignIn - a.lastSignIn),
    inactive: customers.filter((u) => !activeSet.has(u.uid)).map(custRow).sort((a, b) => (a.lastSignIn || a.joined) - (b.lastSignIn || b.joined)),
    newRows: newUsers.map(custRow).sort((a, b) => b.joined - a.joined),
    newSeries: [...newSeriesMap].map(([label, value]) => ({ label, value })),
    split: [{ label: 'New buyers', value: buyers.size - repeat.length }, { label: 'Repeat buyers', value: repeat.length }],
  }

  /* ---- location & delivery ---- */
  const st = new Map<string, { state: string; orders: number; units: number; revenue: number }>()
  const di = new Map<string, { city: string; state: string; orders: number; revenue: number }>()
  for (const o of sales) {
    const s = titleCase(o.shippingAddress?.state), c = titleCase(o.shippingAddress?.city)
    const a = st.get(s) ?? { state: s, orders: 0, units: 0, revenue: 0 }
    a.orders++; a.units += o.items.reduce((n, i) => n + i.quantity, 0); a.revenue += o.total; st.set(s, a)
    const dk = `${c}|${s}`, b = di.get(dk) ?? { city: c, state: s, orders: 0, revenue: 0 }
    b.orders++; b.revenue += o.total; di.set(dk, b)
  }
  const shipOrders = orders.filter((o) => o.tracking?.shippedAt)
  const dispatchHrs = shipOrders.map((o) => ((o.tracking!.shippedAt as number) - (o.paidAt ?? o.createdAt)) / 36e5).filter((h) => h >= 0)
  const carriers = new Map<string, { carrier: string; shipments: number; delivered: number; hours: number }>()
  for (const o of shipOrders) {
    const k = o.tracking?.carrier || 'Unknown'
    const c = carriers.get(k) ?? { carrier: k, shipments: 0, delivered: 0, hours: 0 }
    c.shipments++; if (o.fulfillmentStatus === 'delivered') c.delivered++
    c.hours += Math.max(0, ((o.tracking!.shippedAt as number) - (o.paidAt ?? o.createdAt)) / 36e5); carriers.set(k, c)
  }
  const stDel = new Map<string, { state: string; shipped: number; delivered: number }>()
  for (const o of orders.filter((x) => ['shipped', 'delivered'].includes(x.fulfillmentStatus))) {
    const s = titleCase(o.shippingAddress?.state), a = stDel.get(s) ?? { state: s, shipped: 0, delivered: 0 }
    a.shipped++; if (o.fulfillmentStatus === 'delivered') a.delivered++; stDel.set(s, a)
  }
  const now = Date.now()
  const delayed = orders.filter((o) => ['processing', 'packed'].includes(o.fulfillmentStatus) && o.paymentStatus === 'paid' && now - (o.paidAt ?? o.createdAt) > 48 * 36e5)
    .map((o) => ({ id: o.id, customer: o.shippingAddress?.fullName || o.email, state: titleCase(o.shippingAddress?.state), status: statusLabel(o), placed: o.createdAt, waitingHrs: Math.round((now - (o.paidAt ?? o.createdAt)) / 36e5), total: o.total }))
    .sort((a, b) => b.waitingHrs - a.waitingHrs)
  const stateRows = [...st.values()].sort((a, b) => b.revenue - a.revenue)
  const delivery = {
    shipped: orders.filter((o) => o.fulfillmentStatus === 'shipped').length, delivered: orders.filter((o) => o.fulfillmentStatus === 'delivered').length,
    avgDispatchHrs: dispatchHrs.length ? dispatchHrs.reduce((a, b) => a + b, 0) / dispatchHrs.length : 0,
    carriers: [...carriers.values()].map((c) => ({ ...c, avgHrs: c.shipments ? c.hours / c.shipments : 0, rate: pct(c.delivered, c.shipments) })).sort((a, b) => b.shipments - a.shipments),
    byState: [...stDel.values()].map((s) => ({ ...s, rate: pct(s.delivered, s.shipped) })).sort((a, b) => b.shipped - a.shipped),
    delayed, shipSeries: series(shipOrders, () => 1),
  }
  const location = {
    states: stateRows.map((s) => ({ ...s, share: pct(s.revenue, revenue) })),
    districts: [...di.values()].sort((a, b) => b.revenue - a.revenue).map((x) => ({ ...x, share: pct(x.revenue, revenue) })),
  }

  /* ---- inventory ---- */
  const winFrom = Math.min(range.from, range.to - 30 * DAY)
  const win = history.filter((o) => isSale(o) && o.createdAt >= winFrom && o.createdAt <= range.to)
  const soldBy = new Map<string, number>()
  for (const o of win) for (const i of o.items) incr(soldBy, i.productId, i.quantity)
  const variantRows = products.flatMap((p) => p.variants.map((v) => ({ product: p.name, sku: v.sku ?? p.sku ?? '', size: v.size ?? '—', color: v.color ?? '—', stock: v.stock ?? 0, reserved: v.reserved ?? 0, available: available(v), threshold: p.lowStockThreshold ?? 5, price: unitPrice(p) })))
  const vStatus = (v: { available: number; threshold: number }) => (v.available <= 0 ? 'Out of stock' : v.available <= v.threshold ? 'Low stock' : 'In stock')
  const prodRows = products.map((p) => {
    const av = p.variants.reduce((n, v) => n + Math.max(0, available(v)), 0), sold = soldBy.get(p.id) ?? 0
    return { id: p.id, name: p.name, sku: p.sku ?? '', category: p.categorySlug ?? '', stock: p.variants.reduce((n, v) => n + (v.stock ?? 0), 0), reserved: p.variants.reduce((n, v) => n + (v.reserved ?? 0), 0), available: av, sold, value: av * unitPrice(p), sellThrough: pct(sold, sold + av), created: p.createdAt ?? 0, status: av <= 0 ? 'Out of stock' : av <= (p.lowStockThreshold ?? 5) ? 'Low stock' : 'In stock' }
  })
  const fast = [...prodRows].filter((r) => r.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 15)
  const fastIds = new Set(fast.map((r) => r.id))
  const slow = prodRows.filter((r) => r.available > 0 && r.sold > 0 && !fastIds.has(r.id)).sort((a, b) => a.sold - b.sold || b.available - a.available)
  const dead = prodRows.filter((r) => r.available > 0 && r.sold === 0 && (!r.created || now - r.created > 30 * DAY)).sort((a, b) => b.value - a.value)
  const sizeStock = new Map<string, number>(), colorStock = new Map<string, number>(), matrix = new Map<string, number>()
  for (const v of variantRows) {
    const a = Math.max(0, v.available), s = v.size.toUpperCase(), c = titleCase(v.color)
    incr(sizeStock, s, a); incr(colorStock, c, a); incr(matrix, `${s}|${c}`, a)
  }
  const sizes = [...sizeStock.keys()].sort((a, b) => (sizeOrder.indexOf(a) + 1 || 99) - (sizeOrder.indexOf(b) + 1 || 99) || a.localeCompare(b))
  const colors = [...colorStock.keys()].sort((a, b) => (colorStock.get(b) ?? 0) - (colorStock.get(a) ?? 0))
  const inventory = {
    units: prodRows.reduce((n, r) => n + r.stock, 0), available: prodRows.reduce((n, r) => n + r.available, 0), value: prodRows.reduce((n, r) => n + r.value, 0),
    low: variantRows.filter((v) => vStatus(v) === 'Low stock').sort((a, b) => a.available - b.available).map((v) => ({ ...v, status: 'Low stock' })),
    out: variantRows.filter((v) => vStatus(v) === 'Out of stock').map((v) => ({ ...v, status: 'Out of stock' })),
    variants: variantRows.map((v) => ({ ...v, status: vStatus(v) })), products: prodRows, fast, slow, dead, deadValue: dead.reduce((n, r) => n + r.value, 0),
    sizes: sizes.map((s) => ({ label: s, value: sizeStock.get(s) ?? 0 })), colors: colors.map((c) => ({ label: c, value: colorStock.get(c) ?? 0 })),
    matrix: { sizes, colors, cell: (s: string, c: string) => matrix.get(`${s}|${c}`) ?? 0 }, windowFrom: winFrom,
    mix: [{ label: 'In stock', value: variantRows.filter((v) => vStatus(v) === 'In stock').length }, { label: 'Low stock', value: variantRows.filter((v) => vStatus(v) === 'Low stock').length }, { label: 'Out of stock', value: variantRows.filter((v) => vStatus(v) === 'Out of stock').length }],
  }

  /* ---- orders & payments ---- */
  const buckets = STATUS_BUCKETS.map((b) => ({ ...b, count: orders.filter(b.match).length, value: orders.filter(b.match).reduce((n, o) => n + o.total, 0) }))
  const failed = orders.filter((o) => o.paymentStatus === 'failed')
  const cancelled = orders.filter((o) => o.fulfillmentStatus === 'cancelled')
  const payMix = new Map<string, number>()
  for (const o of orders) incr(payMix, o.paymentStatus)
  const ordersReport = {
    buckets, all: orders, failed, cancelled,
    failedValue: failed.reduce((n, o) => n + o.total, 0), cancelledValue: cancelled.reduce((n, o) => n + o.total, 0),
    failRate: pct(failed.length, orders.length), cancelRate: pct(cancelled.length, orders.length),
    failedSeries: series(failed, () => 1), cancelledSeries: series(cancelled, () => 1),
    payMix: [...payMix].map(([label, value]) => ({ label: label.replace(/_/g, ' '), value })),
  }

  return { range, orders, sales, overview, perf: { best, lowSelling, sizeRows, colorRows }, engagement, cust, location, delivery, inventory, ordersReport, tick: tickFor(range.gran) }
}
export type Analysis = ReturnType<typeof analyse>
