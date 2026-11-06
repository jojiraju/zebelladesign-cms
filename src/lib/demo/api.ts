/* eslint-disable @typescript-eslint/no-explicit-any */
/** Demo backend for the storefront's /api/admin/* endpoints, working on the same in-memory data. */
import { getSeed } from './seed'

const lag = () => new Promise((r) => setTimeout(r, 120))

export async function demoApi(path: string, init: RequestInit = {}): Promise<any> {
  await lag()
  const { db, users } = getSeed()
  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ? JSON.parse(String(init.body)) : {}
  const url = new URL(path, 'http://demo.local')
  const p = url.pathname

  if (p === '/api/admin/users' && method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    return { users: users.filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)) }
  }
  if (p === '/api/admin/users' && method === 'POST') {
    const u = users.find((x) => x.uid === body.uid)
    if (!u) throw new Error('User not found')
    u.role = body.role ?? null
    return { ok: true }
  }
  if (p === '/api/admin/inventory') {
    const prod = db.get('products')?.get(body.productId)
    if (!prod) throw new Error('Product not found')
    const v = prod.variants.find((x: any) => x.id === body.variantId)
    if (!v) throw new Error('Variant not found')
    if (v.stock + body.delta < 0) throw new Error('Stock cannot go below zero.')
    v.stock += body.delta
    db.get('inventoryMovements')!.set(`m${Date.now()}`, { productId: body.productId, variantId: body.variantId, delta: body.delta, reason: body.reason, actor: 'admin@zebelladesigns.example', createdAt: Date.now() })
    return { ok: true }
  }
  const om = p.match(/^\/api\/admin\/orders\/([^/]+)(\/refund)?$/)
  if (om) {
    const o = db.get('orders')?.get(decodeURIComponent(om[1]))
    if (!o) throw new Error('Order not found')
    if (om[2]) {
      const amount = Math.round(Number(body.amount) * 100) || o.total
      o.paymentStatus = 'refunded'
      o.refund = { id: `rfnd_${Date.now()}`, amount, status: 'processed', at: Date.now(), reason: body.reason }
      return { ok: true }
    }
    if (body.action === 'status') {
      o.fulfillmentStatus = body.status
      if (body.status === 'cancelled') { o.cancelReason = 'Cancelled by admin'; if (o.paymentStatus === 'paid') o.paymentStatus = 'refund_pending' }
    } else if (body.action === 'note') {
      (o.notes ??= []).push({ text: body.text, by: 'admin@zebelladesigns.example', at: Date.now() })
    } else if (body.action === 'tracking') {
      o.tracking = { carrier: body.carrier, trackingNumber: body.trackingNumber, url: body.url, shippedAt: Date.now() }
      if (o.fulfillmentStatus === 'packed') o.fulfillmentStatus = 'shipped'
    }
    return { ok: true }
  }
  if (p === '/api/admin/revalidate') return { ok: true }
  if (p === '/api/admin/bootstrap') return { message: 'Demo mode — nothing to claim.' }
  return {}
}
