import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'

export interface DayStat {
  day: string
  orders: number
  revenue: number
  discount?: number
  products?: Record<string, { name: string; qty: number; revenue: number }>
  categories?: Record<string, { qty: number; revenue: number }>
}

/**
 * Loads the most recent `days` daily summaries written by the server when a payment is VERIFIED.
 * Definitions:
 *  - revenue   = sum of order totals (incl. shipping, GST-inclusive) for orders whose payment was verified server-side
 *  - orders    = number of such orders
 *  - AOV       = revenue / orders
 * Refunds are not netted out of these figures (they are tracked per order). Unverified/failed payments are never counted.
 */
export async function loadStats(days: number): Promise<DayStat[]> {
  const snap = await getDocs(query(collection(db, 'statsDaily'), orderBy('day', 'desc'), limit(days)))
  return snap.docs.map((d) => d.data() as DayStat).sort((a, b) => a.day.localeCompare(b.day))
}

export function summarise(stats: DayStat[]) {
  const orders = stats.reduce((n, s) => n + (s.orders || 0), 0)
  const revenue = stats.reduce((n, s) => n + (s.revenue || 0), 0)
  const prod = new Map<string, { name: string; qty: number; revenue: number }>()
  const cat = new Map<string, { qty: number; revenue: number }>()
  for (const s of stats) {
    for (const [id, p] of Object.entries(s.products ?? {})) {
      const cur = prod.get(id) ?? { name: p.name, qty: 0, revenue: 0 }
      cur.qty += p.qty; cur.revenue += p.revenue; prod.set(id, cur)
    }
    for (const [slug, c] of Object.entries(s.categories ?? {})) {
      const cur = cat.get(slug) ?? { qty: 0, revenue: 0 }
      cur.qty += c.qty; cur.revenue += c.revenue; cat.set(slug, cur)
    }
  }
  return {
    orders, revenue, aov: orders ? Math.round(revenue / orders) : 0,
    topProducts: [...prod].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 8),
    categories: [...cat].map(([slug, v]) => ({ slug, ...v })).sort((a, b) => b.revenue - a.revenue),
  }
}

export function groupByMonth(stats: DayStat[]) {
  const m = new Map<string, { orders: number; revenue: number }>()
  for (const s of stats) {
    const k = s.day.slice(0, 7)
    const cur = m.get(k) ?? { orders: 0, revenue: 0 }
    cur.orders += s.orders || 0; cur.revenue += s.revenue || 0; m.set(k, cur)
  }
  return [...m].map(([label, v]) => ({ label, ...v }))
}
