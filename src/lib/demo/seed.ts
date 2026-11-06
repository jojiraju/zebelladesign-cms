/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Demo dataset shown while Firebase isn't configured. Everything is generated in memory (deterministic, relative to "now")
 * from the storefront's own sample catalogue, so pages, charts and Excel exports all have realistic data to show.
 * Nothing here is real inventory, customers or sales.
 */
import { CATEGORY_DEFS, COLLECTION_DEFS, COLORS, PRODUCT_SPECS } from './specs'
import { MOCK_POLICIES } from './policies'
import PHOTOS from './photos.json'

export type Row = Record<string, any>
export interface DemoUser { uid: string; email: string; name: string; verified: boolean; createdAt: string; lastSignIn: string; role: string | null }

const DAY = 864e5
const photos = PHOTOS as Record<string, string>
const img = (slug: string, n: number) => `/demo/products/${slug}-${n}.${photos[`${slug}-${n}`] ?? 'svg'}`
const art = (name: string) => `/demo/art/${name}`

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 } }

const FIRST = ['Aarya', 'Meher', 'Noor', 'Ishani', 'Tara', 'Zoya', 'Rhea', 'Kavya', 'Anvi', 'Sana', 'Diya', 'Mira', 'Ananya', 'Meera', 'Priya', 'Divya', 'Ishita', 'Neha', 'Pooja', 'Aditi', 'Sneha', 'Fatima', 'Lakshmi', 'Anjali']
const LAST = ['Nair', 'Menon', 'Iyer', 'Reddy', 'Shah', 'Khan', 'Patel', 'Joseph', 'Pillai', 'Sharma', 'Rao', 'Thomas', 'Kurian', 'Gupta', 'Das']
const PLACES: [string, string, string][] = [ // state, city, pincode
  ['Kerala', 'Kochi', '682001'], ['Kerala', 'Thrissur', '680001'], ['Kerala', 'Kozhikode', '673001'], ['Kerala', 'Thiruvananthapuram', '695001'],
  ['Tamil Nadu', 'Chennai', '600001'], ['Tamil Nadu', 'Coimbatore', '641001'], ['Tamil Nadu', 'Madurai', '625001'],
  ['Karnataka', 'Bengaluru', '560001'], ['Karnataka', 'Mysuru', '570001'], ['Maharashtra', 'Mumbai', '400001'], ['Maharashtra', 'Pune', '411001'],
  ['Delhi', 'New Delhi', '110001'], ['Telangana', 'Hyderabad', '500001'], ['Gujarat', 'Ahmedabad', '380001'], ['Gujarat', 'Surat', '395001'], ['West Bengal', 'Kolkata', '700001'],
]
const PLACE_W = [0.1, 0.05, 0.04, 0.05, 0.1, 0.05, 0.03, 0.1, 0.04, 0.08, 0.05, 0.07, 0.07, 0.03, 0.02, 0.02]
const CARRIERS: [string, string][] = [['Delhivery', 'https://www.delhivery.com/track/package/'], ['DTDC', 'https://www.dtdc.in/tracking/'], ['India Post', 'https://www.indiapost.gov.in/'], ['Blue Dart', 'https://www.bluedart.com/tracking']]
const SIZES = ['S', 'M', 'L', 'XL']

export interface Seed { db: Map<string, Map<string, Row>>; users: DemoUser[] }

let cached: Seed | null = null
export function getSeed(): Seed { return (cached ??= build()) }

function build(): Seed {
  const r = rng(20261105)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  const now = Date.now()
  const db = new Map<string, Map<string, Row>>()
  const put = (col: string, id: string, data: Row) => { if (!db.has(col)) db.set(col, new Map()); db.get(col)!.set(id, data) }
  let seq = 0
  const uid = () => `${(++seq).toString(36)}${Math.floor(r() * 1e9).toString(36)}`

  /* ---------- categories & collections ---------- */
  CATEGORY_DEFS.forEach((c, i) => {
    const first = PRODUCT_SPECS.find((p) => p.cat === c.slug)!
    put('categories', c.slug, { slug: c.slug, name: c.name, description: c.description, imageUrl: img(first.slug, 1), order: i, visible: true, seo: { title: `${c.name} | Zebella Designs`, description: c.description } })
  })
  COLLECTION_DEFS.forEach((c, i) => {
    const art_ = photos[`collection-${c.slug}`] ? art(`collection-${c.slug}.${photos[`collection-${c.slug}`]}`) : art('collection-1.svg')
    put('collections', c.slug, { slug: c.slug, name: c.name, description: c.description, imageUrl: art_, order: i, visible: true, featured: !!(c as any).featured, seo: { title: `${c.name} | Zebella Designs` } })
  })

  /* ---------- products ---------- */
  const products: Row[] = PRODUCT_SPECS.map((p, i) => {
    const variants = p.colors.flatMap((ck, ci) => SIZES.map((size, si) => {
      const seed = (i * 7 + ci * 5 + si * 3) % 11
      const stock = p.slug === 'polka-frock-navy' ? 0 : seed === 0 ? 0 : seed === 1 ? 2 : seed === 2 ? 3 : 4 + seed * 2
      return { id: `${ck}-${size.toLowerCase()}`, sku: `${p.code}-${ck.toUpperCase()}-${size}`, size, color: COLORS[ck].name, colorHex: COLORS[ck].hex, stock, reserved: seed === 5 ? 1 : 0 }
    }))
    const status = i === 7 ? 'archived' : i % 11 === 10 ? 'draft' : 'published'
    const doc: Row = {
      id: p.slug, name: p.name, slug: p.slug, sku: p.code,
      description: `<p>${p.desc}</p><h3>Fabric</h3><ul><li>${p.fabric}</li><li>Lined for comfort</li></ul><h3>Sizes available</h3><ul><li>S: 34″ bust</li><li>M: 36″</li><li>L: 38″</li><li>XL: 40″</li></ul>`,
      fabric: p.fabric, care: 'Dry clean recommended. Steam iron on low heat. Store on a padded hanger.',
      sizeGuide: '<p>Bust: S 34″ · M 36″ · L 38″ · XL 40″. Need a custom fit? Message us.</p>',
      categoryId: p.cat, categorySlug: p.cat, collectionIds: p.cols,
      images: [1, 2].map((n) => ({ url: img(p.slug, n), alt: `${p.name} — view ${n}` })),
      price: p.mrp * 100, salePrice: p.sale ? p.sale * 100 : null, variants, lowStockThreshold: 3, status,
      featured: p.flags.includes('f'), newArrival: p.flags.includes('n'), bestSeller: p.flags.includes('b'), soldCount: p.sold,
      seo: { title: `${p.name} | Zebella Designs`, description: p.desc }, createdAt: now - (20 + i * 9) * DAY, updatedAt: now - i * DAY,
    }
    return doc
  })

  /* ---------- coupons ---------- */
  const coupons: Row[] = [
    { id: 'WELCOME10', code: 'WELCOME10', type: 'percent', value: 10, minOrder: 99900, startsAt: now - 400 * DAY, endsAt: null, usageLimit: null, perUserLimit: 1, usedCount: 0, active: true },
    { id: 'FESTIVE500', code: 'FESTIVE500', type: 'fixed', value: 50000, minOrder: 299900, startsAt: now - 60 * DAY, endsAt: now + 30 * DAY, usageLimit: 500, perUserLimit: 2, usedCount: 0, active: true },
    { id: 'ZEBELLA15', code: 'ZEBELLA15', type: 'percent', value: 15, minOrder: 199900, maxDiscount: 100000, startsAt: now - 200 * DAY, endsAt: null, usageLimit: 1000, perUserLimit: 1, usedCount: 0, active: true },
    { id: 'CHRISTMAS20', code: 'CHRISTMAS20', type: 'percent', value: 20, minOrder: 149900, maxDiscount: 150000, collectionIds: ['christmas-collection'], startsAt: now - 10 * DAY, endsAt: now + 50 * DAY, usageLimit: 300, perUserLimit: 1, usedCount: 0, active: true },
    { id: 'MONSOON10', code: 'MONSOON10', type: 'percent', value: 10, minOrder: 99900, startsAt: now - 300 * DAY, endsAt: now - 220 * DAY, usageLimit: 200, usedCount: 0, active: false },
    { id: 'FREESHIP', code: 'FREESHIP', type: 'fixed', value: 9900, minOrder: 0, startsAt: now - 120 * DAY, endsAt: null, usageLimit: null, usedCount: 0, active: false },
  ]

  /* ---------- customers (storefront accounts + 3 staff) ---------- */
  const users: DemoUser[] = Array.from({ length: 260 }, (_, i) => {
    const created = now - Math.floor(Math.pow(r(), 0.8) * 760) * DAY - Math.floor(r() * DAY)
    const f = pick(FIRST), l = pick(LAST)
    const quiet = r() < 0.38
    const lastSignIn = quiet ? created + Math.floor(r() * 120) * DAY : now - Math.floor(Math.pow(r(), 2) * 90) * DAY
    return { uid: `u${i + 1}`, email: `${f.toLowerCase()}.${l.toLowerCase()}${i}@example.com`, name: `${f} ${l}`, verified: r() < 0.92, createdAt: new Date(created).toISOString(), lastSignIn: new Date(Math.min(now, Math.max(created, lastSignIn))).toISOString(), role: null }
  })
  users.unshift(
    { uid: 'staff1', email: 'admin@zebelladesigns.example', name: 'Zebella Admin', verified: true, createdAt: new Date(now - 700 * DAY).toISOString(), lastSignIn: new Date(now - 3600e3).toISOString(), role: 'admin' },
    { uid: 'staff2', email: 'content@zebelladesigns.example', name: 'Content Editor', verified: true, createdAt: new Date(now - 420 * DAY).toISOString(), lastSignIn: new Date(now - 2 * DAY).toISOString(), role: 'editor' },
    { uid: 'staff3', email: 'dispatch@zebelladesigns.example', name: 'Dispatch Team', verified: true, createdAt: new Date(now - 380 * DAY).toISOString(), lastSignIn: new Date(now - 6 * 3600e3).toISOString(), role: 'fulfillment' },
  )
  const shoppers = users.filter((u) => !u.role)

  /* ---------- orders ---------- */
  const weights = products.map((p) => (PRODUCT_SPECS.find((s) => s.slug === p.id)?.sold ?? 50) + 20)
  const wSum = weights.reduce((a, b) => a + b, 0)
  const pickProduct = () => { let x = r() * wSum, i = 0; while (i < weights.length - 1 && x > weights[i]) { x -= weights[i]; i++ } return products[i] }
  const pickPlace = () => { let x = r(), i = 0; while (i < PLACE_W.length - 1 && x > PLACE_W[i]) { x -= PLACE_W[i]; i++ } return PLACES[i] }
  const orders: Row[] = []
  const soldByVariant = new Map<string, number>()
  const start = new Date(now - 800 * DAY); start.setHours(0, 0, 0, 0)
  let n = 0
  for (let t = start.getTime(); t <= now; t += DAY) {
    const daysAgo = (now - t) / DAY
    const dow = new Date(t).getDay(), month = new Date(t).getMonth()
    const growth = 0.7 + (1 - daysAgo / 800) * 1.6
    const festive = month === 9 || month === 10 || month === 11 ? 1.5 : month === 3 ? 1.2 : 1
    const weekend = dow === 0 || dow === 6 ? 1.25 : 1
    const k = growth * festive * weekend
    const count = Math.floor(k + r() * 1.8)
    for (let j = 0; j < count; j++) {
      const u = shoppers[Math.floor(Math.pow(r(), 1.6) * shoppers.length)]
      const lines = 1 + (r() < 0.38 ? 1 : 0) + (r() < 0.1 ? 1 : 0)
      const items = Array.from({ length: lines }, () => {
        const p = pickProduct(), v = pick(p.variants as Row[]), q = r() < 0.14 ? 2 : 1, unit = (p.salePrice ?? p.price) as number
        return { productId: p.id, variantId: v.id, name: p.name, sku: v.sku, image: p.images[0].url, size: v.size, color: v.color, quantity: q, unitPrice: unit, listPrice: p.price, lineTotal: unit * q }
      })
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
      const cp = r() < 0.2 ? pick(coupons.filter((c) => c.active)) : null
      let discount = 0
      if (cp && subtotal >= (cp.minOrder ?? 0)) {
        discount = cp.type === 'percent' ? Math.min(Math.round((subtotal * cp.value) / 100), cp.maxDiscount ?? Infinity) : cp.value
      }
      const shipping = subtotal - discount >= 299900 ? 0 : 9900
      const total = subtotal - discount + shipping
      const createdAt = t + Math.floor(r() * 0.9 * DAY)
      if (createdAt > now) continue
      const age = (now - createdAt) / DAY
      const x = r()
      let paymentStatus = 'paid', fulfillmentStatus = 'delivered'
      if (x < 0.06) { paymentStatus = 'failed'; fulfillmentStatus = 'awaiting_payment' }
      else if (x < 0.1) { paymentStatus = age > 3 ? 'failed' : 'pending'; fulfillmentStatus = 'awaiting_payment' }
      else if (x < 0.165) { fulfillmentStatus = 'cancelled'; paymentStatus = r() < 0.55 ? 'refunded' : 'paid' }
      else if (age < 1.2) fulfillmentStatus = 'processing'
      else if (age < 2.5) fulfillmentStatus = pick(['processing', 'packed'])
      else if (age < 6) fulfillmentStatus = pick(['packed', 'shipped', 'shipped'])
      else if (age < 9 && r() < 0.35) fulfillmentStatus = 'shipped'
      const shipped = fulfillmentStatus === 'shipped' || fulfillmentStatus === 'delivered'
      const paid = paymentStatus === 'paid' || paymentStatus === 'refunded'
      const [state, city, pincode] = pickPlace()
      const [carrier, trackUrl] = pick(CARRIERS)
      const id = `ZB-${String(24001 + n++)}`
      const shippedAt = createdAt + (5 + Math.floor(r() * 54)) * 36e5
      const place = { fullName: u.name, phone: `9${Math.floor(100000000 + r() * 899999999)}`, line1: `${Math.floor(1 + r() * 240)}, ${pick(['Rose Villa', 'Lake View Apartments', 'MG Road', 'Temple Street', 'Green Park', 'Palm Residency'])}`, city, state, pincode, country: 'India' }
      const o: Row = {
        id, userId: u.uid, email: u.email, phone: place.phone, shippingAddress: place, billingAddress: place, items, subtotal, discount, couponCode: discount ? cp!.code : undefined,
        shipping, taxIncluded: Math.round((total * 5) / 105), total, currency: 'INR', shippingMethodId: 'standard', paymentProvider: 'razorpay', paymentMode: 'live',
        paymentStatus, fulfillmentStatus, providerOrderId: `order_${uid()}`, providerPaymentId: paid || paymentStatus === 'failed' ? `pay_${uid()}` : undefined,
        paidAt: paid ? createdAt + 45e3 : null, createdAt, updatedAt: createdAt,
      }
      if (shipped) o.tracking = { carrier, trackingNumber: `${carrier.slice(0, 2).toUpperCase()}${Math.floor(1e9 + r() * 8e9)}`, url: trackUrl, shippedAt }
      if (fulfillmentStatus === 'cancelled') o.cancelReason = pick(['Customer requested cancellation', 'Size unavailable', 'Address could not be verified', 'Duplicate order', 'Payment issue'])
      if (paymentStatus === 'refunded') o.refund = { id: `rfnd_${uid()}`, amount: total, status: 'processed', at: createdAt + 2 * DAY, reason: o.cancelReason }
      if (r() < 0.08) o.notes = [{ text: pick(['Customer asked for gift wrap.', 'Called to confirm address.', 'Priority dispatch requested.', 'Fabric swatch sent before stitching.']), by: 'admin@zebelladesigns.example', at: createdAt + 3600e3 }]
      if (discount) { const c = coupons.find((c) => c.code === cp!.code)!; c.usedCount++ }
      if (paid && fulfillmentStatus !== 'cancelled') for (const it of items) soldByVariant.set(`${it.productId}|${it.variantId}`, (soldByVariant.get(`${it.productId}|${it.variantId}`) ?? 0) + it.quantity)
      orders.push(o)
    }
  }

  // The most recent orders are still "live" — make sure every status is represented near the top of the list.
  orders.sort((a, b) => a.createdAt - b.createdAt)
  const tail = orders.slice(-14)
  const order = ['awaiting_payment', 'processing', 'processing', 'packed', 'packed', 'shipped']
  tail.slice(0, order.length).forEach((o, i) => {
    o.fulfillmentStatus = order[i]; o.paymentStatus = i === 0 ? 'pending' : 'paid'; o.paidAt = i === 0 ? null : o.createdAt + 45e3
    if (i < 4) delete o.tracking; if (i === 0) { o.providerPaymentId = undefined }
    if (i === 5 && !o.tracking) o.tracking = { carrier: 'Delhivery', trackingNumber: 'DL4829104857', url: CARRIERS[0][1], shippedAt: now - 3600e3 * 8 }
  })
  orders.forEach((o) => put('orders', o.id, o))

  /* ---------- products: stock history + sold counts ---------- */
  const moves: Row[] = []
  for (const p of products) {
    for (const v of p.variants as Row[]) {
      const sold = soldByVariant.get(`${p.id}|${v.id}`) ?? 0
      moves.push({ productId: p.id, variantId: v.id, delta: v.stock + v.reserved + sold, reason: 'initial stock', actor: 'admin@zebelladesigns.example', createdAt: p.createdAt })
      if (r() < 0.12) moves.push({ productId: p.id, variantId: v.id, delta: -1, reason: pick(['damaged in handling', 'stock recount']), actor: 'dispatch@zebelladesigns.example', createdAt: now - Math.floor(r() * 120) * DAY })
      if (r() < 0.1) moves.push({ productId: p.id, variantId: v.id, delta: 6, reason: 'restock from workshop', actor: 'admin@zebelladesigns.example', createdAt: now - Math.floor(r() * 200) * DAY })
    }
    put('products', p.id, p)
  }
  for (const o of orders) if (o.paymentStatus === 'paid' && o.fulfillmentStatus !== 'cancelled' && now - o.createdAt < 200 * DAY) for (const it of o.items) moves.push({ productId: it.productId, variantId: it.variantId, delta: -it.quantity, reason: 'order', orderId: o.id, createdAt: o.createdAt })
  moves.forEach((m) => put('inventoryMovements', uid(), m))

  coupons.forEach((c) => put('coupons', c.id, c))

  /* ---------- daily stats (what the storefront writes on verified payments) ---------- */
  const stats = new Map<string, Row>()
  const ymd = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  for (const o of orders) {
    if (o.paymentStatus !== 'paid' || o.fulfillmentStatus === 'cancelled') continue
    const day = ymd(o.createdAt)
    const s = stats.get(day) ?? { day, orders: 0, revenue: 0, discount: 0, products: {}, categories: {} }
    s.orders++; s.revenue += o.total; s.discount += o.discount
    for (const it of o.items) {
      const p = s.products[it.productId] ?? { name: it.name, qty: 0, revenue: 0 }; p.qty += it.quantity; p.revenue += it.lineTotal; s.products[it.productId] = p
      const slug = products.find((x) => x.id === it.productId)!.categorySlug
      const c = s.categories[slug] ?? { qty: 0, revenue: 0 }; c.qty += it.quantity; c.revenue += it.lineTotal; s.categories[slug] = c
    }
    stats.set(day, s)
  }
  stats.forEach((s, day) => put('statsDaily', day, s))

  /* ---------- storefront engagement events ---------- */
  for (let i = 0; i < 14000; i++) {
    const p = pickProduct()
    const type = r() < 0.72 ? 'view' : r() < 0.6 ? 'cart' : 'wishlist'
    put('productEvents', uid(), { productId: p.id, name: p.name, type, createdAt: now - Math.floor(Math.pow(r(), 1.7) * 420 * DAY) })
  }

  /* ---------- content ---------- */
  put('banners', 'b1', { heading: 'Designed to be remembered', description: 'The signature edit — embroidered anarkalis and gowns.', ctaLabel: 'Shop the collection', href: '/shop', desktopImage: art('hero-banner.webp'), mobileImage: art('hero-banner-mobile.webp'), status: 'published', order: 0, startsAt: now - 60 * DAY, endsAt: null })
  put('banners', 'b2', { heading: 'New Arrivals', description: 'Fresh silhouettes, just landed.', ctaLabel: 'Shop now', href: '/shop?sort=newest', desktopImage: art('hero-new-arrivals.webp'), mobileImage: art('hero-new-arrivals-mobile.webp'), status: 'published', order: 1, startsAt: now - 20 * DAY, endsAt: now + 40 * DAY })
  put('banners', 'b3', { heading: 'Festive Collection', description: 'Embroidered, trimmed and made for celebrations.', ctaLabel: 'Explore collection', href: '/collections/festive-wear', desktopImage: art('hero-festive.webp'), mobileImage: art('hero-festive-mobile.webp'), status: 'published', order: 2, startsAt: now - 5 * DAY, endsAt: now + 60 * DAY })
  put('banners', 'b4', { heading: 'Elegant Ethnic Wear', description: 'Draft — scheduled for the wedding season.', ctaLabel: 'Shop the collection', href: '/shop', desktopImage: art('hero-ethnic.webp'), mobileImage: art('hero-ethnic-mobile.webp'), status: 'draft', order: 3, startsAt: now + 30 * DAY, endsAt: now + 90 * DAY })

  ;[
    ['Ananya S.', 'Bengaluru', 'The anarkali fits beautifully and the colour is exactly like the photos. Got so many compliments at the wedding.', true, 'published'],
    ['Meera K.', 'Hyderabad', 'Lovely quality for the price. The cotton salwar set is my new everyday favourite.', true, 'published'],
    ['Priya R.', 'Chennai', 'Ordered the Christmas frock for my daughter — the velvet is soft and the bow is adorable.', true, 'published'],
    ['Sana A.', 'Mumbai', 'Fast delivery and beautiful packaging. The co-ord set is so comfortable.', true, 'published'],
    ['Divya M.', 'Kochi', "The gown looked stunning at my cousin's reception. Fits true to size.", true, 'published'],
    ['Ishita P.', 'Pune', 'Great customer service — they helped me pick the right size.', false, 'draft'],
  ].forEach(([name, location, quote, verified, status], i) => put('testimonials', `t${i + 1}`, { name, location, quote, verified, status }))

  put('homepageContent', 'main', {
    hero: { textInImage: true, imageUrl: art('hero-banner.webp'), mobileImageUrl: art('hero-banner-mobile.webp'), heading: 'Designed to be remembered', ctaHref: '/shop' },
    featuredCollections: [
      { title: 'New Arrivals', subtitle: 'Just landed', imageUrl: art('tile-new.webp'), href: '/shop?sort=newest', size: 'large' },
      { title: 'Christmas Collection', imageUrl: art('collection-christmas-collection.webp'), href: '/collections/christmas-collection', size: 'tall' },
      { title: 'Festive Wear', imageUrl: art('collection-festive-wear.webp'), href: '/collections/festive-wear', size: 'wide' },
      { title: 'Signature Collection', imageUrl: art('collection-signature-collection.webp'), href: '/collections/signature-collection', size: 'small' },
      { title: 'Best Sellers', imageUrl: art('tile-best.webp'), href: '/shop?sort=popular', size: 'small' },
    ],
    featuredProductIds: products.filter((p) => p.featured || p.bestSeller).slice(0, 8).map((p) => p.id),
    brandStory: { eyebrow: 'Our Story', heading: 'Small, soft, ours.', body: '<p>Zebella began as a quiet dream: clothes made with the same care a nurse gives her patients. Every piece is designed in-house, finished by hand and made to be remembered.</p>', imageUrl: img('embroidered-gown-royal-blue', 1), points: [{ title: "A nurse's heart", text: 'Made with the same care a nurse gives.' }, { title: 'Our own label', text: 'Our own name stitched inside.' }, { title: 'Starting small', text: 'Small in India, dreaming worldwide.' }] },
    social: products.slice(0, 6).map((p) => ({ imageUrl: p.images[0].url, href: `/products/${p.id}`, alt: `${p.name}, styled` })),
    editorialMessage: 'Designed to be remembered.',
  })

  put('settings', 'store', {
    announcements: [{ id: 'a1', text: 'Free shipping on orders above ₹2,999', href: '/shop' }, { id: 'a2', text: 'The Christmas Collection is here', href: '/collections/christmas-collection' }, { id: 'a3', text: 'Handcrafted just for you', href: '/about' }],
    shippingMethods: [{ id: 'standard', label: 'Standard Delivery', fee: 9900, freeAbove: 299900, eta: '5–8 business days' }, { id: 'express', label: 'Express Delivery', fee: 24900, freeAbove: null, eta: '2–3 business days' }],
    taxInclusiveRatePercent: 5,
    contact: { email: 'hello@zebelladesigns.example', phone: '+91 90000 00000', address: 'Zebella Designs Studio\n12, Fashion Street, Kochi, Kerala, India', hours: 'Mon–Sat, 10:30 am – 7:00 pm' },
    social: { instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/', pinterest: 'https://www.pinterest.com/', youtube: 'https://www.youtube.com/' },
    footer: { description: 'Contemporary ethnic and festive wear, designed with care and made to be remembered.' },
    newsletter: { enabled: true, heading: 'Join the Zebella list', consent: 'By subscribing you agree to receive occasional emails about new collections. Unsubscribe anytime.' },
    policies: MOCK_POLICIES,
    faq: [
      { q: 'How do I find my size?', a: '<p>Use the size guide on each product page. For a custom fit, message us with your measurements.</p>' },
      { q: 'How long does delivery take?', a: '<p>Standard delivery takes 5–8 business days across India.</p>' },
      { q: 'Can I return or exchange an item?', a: '<p>Yes — unworn items with tags can be returned within 7 days of delivery.</p>' },
      { q: 'How do I track my order?', a: '<p>Use the Track Order page with your order ID and email, or check My Account.</p>' },
    ],
    pincodeCheck: { enabled: true, note: 'Delivery is available at your PIN code. Estimated 5–8 business days.' },
  })

  Array.from({ length: 84 }, (_, i) => {
    const f = pick(FIRST).toLowerCase(), l = pick(LAST).toLowerCase()
    put('newsletterSubscribers', `s${i}`, { email: `${f}.${l}${Math.floor(r() * 99)}@example.com`, createdAt: now - Math.floor(Math.pow(r(), 1.4) * 300 * DAY), source: pick(['footer', 'footer', 'popup', 'checkout']) })
  })

  const actions: [string, () => string, () => Row | null][] = [
    ['product.update', () => pick(products).id, () => ({ field: 'price' })], ['product.create', () => pick(products).id, () => ({ name: pick(products).name })],
    ['order.status', () => pick(orders).id, () => ({ to: pick(['packed', 'shipped', 'delivered']) })], ['order.tracking', () => pick(orders).id, () => ({ carrier: pick(CARRIERS)[0] })],
    ['inventory.adjust', () => pick(products).id, () => ({ delta: pick([-1, 4, 6, -2]) })], ['coupon.update', () => pick(coupons).id, () => null],
    ['settings.store.update', () => 'settings/store', () => null], ['homepageContent.main.update', () => 'homepageContent/main', () => null], ['banner.update', () => 'b1', () => ({ status: 'published' })],
  ]
  Array.from({ length: 46 }, (_, i) => {
    const [action, target, detail] = pick(actions), who = pick(users.filter((u) => u.role))
    put('adminAuditLogs', `l${i}`, { actor: who.uid, actorEmail: who.email, action, target: target(), detail: detail(), createdAt: now - Math.floor(Math.pow(r(), 1.5) * 60 * DAY) })
  })

  return { db, users }
}
