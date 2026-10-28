import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useDocs, type Doc } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { audit } from '../lib/audit'
import { revalidateStorefront } from '../lib/api'
import { clean, errMsg, formatINR, slugify, toPaise, toRupees } from '../lib/util'
import { Archive, ArrowLeft, Eye, EyeOff, FileText, FolderTree, Image as ImageIcon, Layers, Pencil, Plus, Save, Search, Tag } from 'lucide-react'
import { Badge, Empty, ErrorBox, Field, IconButton, PageHeader, Section, Spinner, Switch, Tabs, useToast } from '../components/ui'
import { DataTable, type TableColumn } from '../components/DataTable'
import { RichField } from '../components/RichText'
import { GalleryEditor, uploadFile, type Img } from '../components/ImageUploader'

interface Variant { id: string; sku: string; size?: string; color?: string; colorHex?: string; stock: number; reserved: number }
interface Product {
  name: string; slug: string; sku: string; description: string; fabric?: string; care?: string; sizeGuide?: string
  categoryId: string; categorySlug: string; collectionIds: string[]; images: Img[]; videoUrl?: string
  price: number; salePrice?: number | null; variants: Variant[]; lowStockThreshold: number
  status: 'draft' | 'published' | 'archived'; featured: boolean; newArrival: boolean; bestSeller: boolean; soldCount: number
  seo?: { title?: string; description?: string }; isDemo?: boolean; createdAt?: number
}

const totalStock = (p: Pick<Product, 'variants'>) => (p.variants ?? []).reduce((n, v) => n + (v.stock - v.reserved), 0)

/* ============================== list ============================== */
export function ProductsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useDocs<Product>('products')
  const [status, setStatus] = useState('all')
  const nav = useNavigate()
  const rows = useMemo(
    () => data.filter((p) => status === 'all' || p.status === status).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [data, status],
  )
  const writable = can('catalog:write')

  async function setProductStatus(id: string, next: Product['status']) {
    try { await updateDoc(doc(db, 'products', id), { status: next, updatedAt: Date.now() }); await audit('product.status', id, { next }); void revalidateStorefront(); reload() } catch (e) { toast(errMsg(e), 'error') }
  }

  const columns: TableColumn<Doc<Product>>[] = [
    { id: 'name', name: 'Product', sortable: true, selector: (p) => p.name, grow: 2.4, minWidth: '260px', cell: (p) => (
      <div className="flex min-w-0 items-center gap-3">
        {p.images?.[0] ? <img src={p.images[0].url} alt="" className="h-14 w-11 shrink-0 rounded-lg object-cover" /> : <div className="h-14 w-11 shrink-0 rounded-lg bg-cream" />}
        <div className="min-w-0"><Link className="link block truncate" to={`/products/${p.id}`}>{p.name}</Link><p className="truncate text-xs text-taupe-deep">{p.sku}{p.isDemo && ' · DEMO'}</p></div>
      </div>) },
    { id: 'price', name: 'Price', sortable: true, selector: (p) => p.salePrice && p.salePrice < p.price ? p.salePrice : p.price, minWidth: '120px', cell: (p) => (p.salePrice && p.salePrice < p.price ? <span><b>{formatINR(p.salePrice)}</b> <s className="text-xs text-taupe-deep">{formatINR(p.price)}</s></span> : formatINR(p.price)) },
    { id: 'stock', name: 'Available', sortable: true, selector: (p) => totalStock(p), minWidth: '120px', cell: (p) => { const n = totalStock(p); return n <= 0 ? <Badge tone="bad">Sold out</Badge> : n <= p.lowStockThreshold ? <Badge tone="warn">{n} low</Badge> : <b>{n}</b> } },
    { id: 'status', name: 'Status', sortable: true, selector: (p) => p.status, minWidth: '120px', cell: (p) => <Badge tone={p.status === 'published' ? 'ok' : p.status === 'archived' ? 'bad' : 'neutral'}>{p.status}</Badge> },
    { name: '', right: true, minWidth: '150px', cell: (p) => !writable ? null : (
      <div className="flex gap-1.5">
        <IconButton label="Edit" to={`/products/${p.id}`} tone="brand"><Pencil size={15} /></IconButton>
        {p.status === 'published'
          ? <IconButton label="Unpublish" onClick={() => setProductStatus(p.id, 'draft')}><EyeOff size={15} /></IconButton>
          : p.status === 'archived' ? <IconButton label="Restore as draft" onClick={() => setProductStatus(p.id, 'draft')}><Eye size={15} /></IconButton>
          : <IconButton label="Publish" onClick={() => setProductStatus(p.id, 'published')}><Eye size={15} /></IconButton>}
        {/* Products that have sold are archived, never hard-deleted, so order history stays intact. */}
        {p.status !== 'archived' && <IconButton label="Archive" tone="danger" onClick={() => { if (window.confirm('Archive this product? It will disappear from the storefront but keep its order history.')) void setProductStatus(p.id, 'archived') }}><Archive size={15} /></IconButton>}
      </div>) },
  ]

  return (
    <div>
      <PageHeader title="Products" subtitle={`${data.length} total`} actions={writable && <Link to="/products/new" className="btn btn-solid"><Plus size={16} />New product</Link>} />
      {error && <ErrorBox message={error} />}
      <Tabs value={status} onChange={setStatus} items={(['all', 'published', 'draft', 'archived'] as const).map((v) => ({ value: v, label: v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1), count: v === 'all' ? data.length : data.filter((x) => x.status === v).length }))} />
      <DataTable columns={columns} data={rows} loading={loading} searchText={(p) => `${p.name} ${p.sku}`} searchPlaceholder="Search name or SKU" onRowClicked={(p) => nav(`/products/${p.id}`)}
        empty={data.length ? 'No products match.' : <Empty title="No products yet" text="Add your first product to start selling. Upload photography, set sizes and stock, then publish.">{writable && <Link to="/products/new" className="btn btn-solid">Add your first product</Link>}</Empty>} />
    </div>
  )
}

/* ============================== editor ============================== */
const blank: Product = {
  name: '', slug: '', sku: '', description: '', fabric: '', care: '', sizeGuide: '', categoryId: '', categorySlug: '', collectionIds: [], images: [],
  videoUrl: '', price: 0, salePrice: null, variants: [], lowStockThreshold: 2, status: 'draft', featured: false, newArrival: false, bestSeller: false, soldCount: 0, seo: {},
}

export function ProductEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const nav = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const [p, setP] = useState<Product | null>(isNew ? blank : null)
  const [price, setPrice] = useState('')
  const [sale, setSale] = useState('')
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sizesText, setSizesText] = useState('')
  const [colorsText, setColorsText] = useState('')
  const cats = useDocs<{ name: string; slug: string }>('categories', useMemo(() => [orderBy('order')], []))
  const cols = useDocs<{ name: string }>('collections', useMemo(() => [orderBy('order')], []))
  const [newId] = useState(() => doc(collection(db, 'products')).id) // pre-allocated so uploads can use the final folder
  const pid = isNew ? newId : id!

  useEffect(() => {
    if (isNew) return
    getDoc(doc(db, 'products', id!)).then((s) => {
      if (!s.exists()) return setLoadErr('Product not found.')
      const d = s.data() as Product
      setP(d); setPrice(toRupees(d.price)); setSale(toRupees(d.salePrice))
    }).catch((e) => setLoadErr(errMsg(e)))
  }, [id, isNew])

  if (loadErr) return <ErrorBox message={loadErr} />
  if (!p) return <Spinner />
  const writable = can('catalog:write')
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((s) => (s ? { ...s, [k]: v } : s))

  function generateVariants() {
    const sizes = sizesText.split(',').map((s) => s.trim()).filter(Boolean)
    const colors = colorsText.split(',').map((s) => s.trim()).filter(Boolean)
    const existing = new Map(p!.variants.map((v) => [v.id, v]))
    const combos: { size?: string; color?: string }[] = []
    for (const s of sizes.length ? sizes : [undefined]) for (const c of colors.length ? colors : [undefined]) combos.push({ size: s, color: c })
    const next: Variant[] = combos.map(({ size, color }) => {
      const vid = slugify([size, color].filter(Boolean).join('-')) || 'default'
      return existing.get(vid) ?? { id: vid, sku: [p!.sku, size, color].filter(Boolean).join('-').toUpperCase().replace(/\s+/g, ''), size, color, stock: 0, reserved: 0 }
    })
    set('variants', next)
  }
  const patchVariant = (vid: string, patch: Partial<Variant>) => set('variants', p.variants.map((v) => (v.id === vid ? { ...v, ...patch } : v)))

  async function save() {
    if (!p) return
    const errs: string[] = []
    if (!p.name.trim()) errs.push('Name is required.')
    if (!p.sku.trim()) errs.push('SKU is required.')
    if (!p.categoryId) errs.push('Choose a category.')
    if (toPaise(price) <= 0) errs.push('Enter a price above zero.')
    if (sale && toPaise(sale) >= toPaise(price)) errs.push('Sale price must be lower than the regular price (or leave it empty).')
    if (!p.variants.length) errs.push('Add at least one size/colour variant (or generate a single default one).')
    if (p.status === 'published' && !p.images.length) errs.push('Add at least one image before publishing.')
    if (errs.length) return toast(errs[0], 'error')
    setBusy(true)
    try {
      const slug = p.slug.trim() || slugify(p.name)
      // Slug uniqueness check (cheap: catalogue is small).
      const all = await getDocs(query(collection(db, 'products')))
      if (all.docs.some((d) => d.id !== pid && d.data().slug === slug)) throw new Error(`Another product already uses the URL "${slug}".`)
      const cat = cats.data.find((c) => c.id === p.categoryId)
      const base = {
        ...p, slug, categorySlug: cat?.slug ?? p.categorySlug, price: toPaise(price), salePrice: sale ? toPaise(sale) : null,
        videoUrl: p.videoUrl || '', updatedAt: Date.now(),
      }
      const ref = doc(db, 'products', pid)
      if (isNew) {
        // Initial stock for brand-new products is allowed; later changes go through Inventory (audited, logged).
        await setDoc(ref, clean({ ...base, createdAt: Date.now(), soldCount: 0, variants: p.variants.map((v) => ({ ...v, reserved: 0 })) }))
        await Promise.all(p.variants.filter((v) => v.stock > 0).map((v) => setDoc(doc(collection(db, 'inventoryMovements')), { productId: pid, variantId: v.id, delta: v.stock, reason: 'initial stock', createdAt: Date.now() })))
      } else {
        // Preserve live stock/reserved counters (changed by checkouts) — never trust the stale copy in this form.
        await runTransaction(db, async (tx) => {
          const cur = await tx.get(ref)
          const live = new Map(((cur.data() as Product).variants ?? []).map((v) => [v.id, v]))
          const variants = p.variants.map((v) => {
            const l = live.get(v.id)
            return l ? { ...v, stock: l.stock, reserved: l.reserved } : { ...v, reserved: 0 }
          })
          tx.set(ref, clean({ ...base, soldCount: (cur.data() as Product).soldCount ?? 0, variants }), { merge: true })
        })
      }
      await audit(isNew ? 'product.create' : 'product.update', pid, { name: p.name })
      void revalidateStorefront()
      toast('Product saved')
      nav('/products')
    } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }}>
      <PageHeader sticky title={isNew ? 'New product' : 'Edit product'} subtitle={p.isDemo ? 'Demo product (development seed data)' : isNew ? 'Fill in the details, then save. You can publish later.' : p.name}
        back={<Link to="/products" className="link inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} />All products</Link>}
        actions={<>{writable && <button className="btn btn-solid" disabled={busy}><Save size={15} />{busy ? 'Saving…' : 'Save product'}</button>}</>} />
      <fieldset disabled={!writable} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Section title="Basic information" hint="Name, URL and the story behind the piece." icon={FileText} tone="rose" className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><input className="field" value={p.name} onChange={(e) => { set('name', e.target.value); if (isNew) set('slug', slugify(e.target.value)) }} /></Field>
            <Field label="URL slug" hint="/products/<slug>"><input className="field" value={p.slug} onChange={(e) => set('slug', slugify(e.target.value))} /></Field>
            <Field label="SKU"><input className="field" value={p.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} /></Field>
            <RichField label="Description" className="sm:col-span-2" minHeight="10rem" placeholder="Describe the design, fit and feel…" value={p.description} onChange={(v) => set('description', v)} />
            <RichField label="Fabric details" value={p.fabric ?? ''} onChange={(v) => set('fabric', v)} placeholder="Fabric, lining, embellishment…" minHeight="6rem" />
            <RichField label="Care instructions" value={p.care ?? ''} onChange={(v) => set('care', v)} placeholder="Dry clean only…" minHeight="6rem" />
            <RichField label="Size guide (optional)" className="sm:col-span-2" value={p.sizeGuide ?? ''} onChange={(v) => set('sizeGuide', v)} placeholder="Measurements and fit notes" minHeight="6rem" />
          </Section>

          <Section title="Images & video" hint="The first image is the cover — hover an image to reorder or remove it." icon={ImageIcon} tone="violet">
            <GalleryEditor images={p.images} onChange={(v) => set('images', v)} folder={`products/${pid}`} />
            <div className="mt-5">
              <Field label="Product video (optional, MP4/WebM up to 50 MB)">
                <input type="file" accept="video/mp4,video/webm" className="field file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-gold-deep" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return
                  try { set('videoUrl', (await uploadFile(f, `products/${pid}`, { video: true })).url); toast('Video uploaded') } catch (err) { toast(errMsg(err), 'error') }
                }} />
              </Field>
              {p.videoUrl && <p className="mt-2 text-xs">Video attached. <button type="button" className="link" onClick={() => set('videoUrl', '')}>Remove</button></p>}
            </div>
          </Section>

          <Section title="Sizes, colours & stock" hint="Enter comma-separated lists and generate variants. Existing variants keep their stock." icon={Layers} tone="emerald">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Sizes"><input className="field" placeholder="S, M, L, XL" value={sizesText} onChange={(e) => setSizesText(e.target.value)} /></Field>
              <Field label="Colours"><input className="field" placeholder="Ivory, Wine" value={colorsText} onChange={(e) => setColorsText(e.target.value)} /></Field>
              <button type="button" className="btn" onClick={generateVariants}>Generate</button>
            </div>
            {p.variants.length > 0 && (
              <div className="mt-5 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[34rem] border-collapse">
                  <thead><tr><th className="th">Variant</th><th className="th">SKU</th><th className="th">Colour swatch</th><th className="th">Stock</th></tr></thead>
                  <tbody>
                    {p.variants.map((v) => (
                      <tr key={v.id}>
                        <td className="td">{[v.size, v.color].filter(Boolean).join(' / ') || 'Default'}</td>
                        <td className="td"><input className="field !min-h-9" value={v.sku} onChange={(e) => patchVariant(v.id, { sku: e.target.value.toUpperCase() })} /></td>
                        <td className="td">{v.color ? <input type="color" aria-label={`Swatch for ${v.color}`} value={v.colorHex || '#d8cbb8'} onChange={(e) => patchVariant(v.id, { colorHex: e.target.value })} className="h-9 w-14" /> : '—'}</td>
                        <td className="td">
                          {isNew
                            ? <input type="number" min={0} className="field !min-h-9 w-24" value={v.stock} onChange={(e) => patchVariant(v.id, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                            : <span title="Adjust on the Inventory page">{v.stock} <span className="text-xs text-taupe-deep">({v.reserved} held)</span></span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!isNew && <p className="mt-2 text-xs text-taupe-deep">Stock for existing variants is changed on the <Link className="link" to="/inventory">Inventory</Link> page so every change is logged.</p>}
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title="Publishing & pricing" icon={Tag} tone="amber" className="space-y-4">
            <div>
              <span className="label">Status</span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
                {(['draft', 'published', 'archived'] as const).map((st) => (
                  <button type="button" key={st} onClick={() => set('status', st)} className={`rounded-lg py-1.5 text-xs font-semibold capitalize transition ${p.status === st ? (st === 'published' ? 'bg-emerald-500 text-white shadow' : st === 'archived' ? 'bg-rose-500 text-white shadow' : 'bg-white text-ink shadow') : 'text-taupe-deep hover:text-ink'}`}>{st}</button>
                ))}
              </div>
            </div>
            <Field label="Regular price (₹)"><input type="number" min={0} step="0.01" className="field" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            <Field label="Sale price (₹)" hint="Optional. Only shown as a discount when lower than the regular price."><input type="number" min={0} step="0.01" className="field" value={sale} onChange={(e) => setSale(e.target.value)} /></Field>
            <Field label="Low-stock alert at"><input type="number" min={0} className="field" value={p.lowStockThreshold} onChange={(e) => set('lowStockThreshold', Math.max(0, Number(e.target.value) || 0))} /></Field>
          </Section>
          <Section title="Organisation" icon={FolderTree} tone="sky" className="space-y-4">
            <Field label="Category">
              <select className="field" value={p.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Select…</option>{cats.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!cats.loading && !cats.data.length && <span className="mt-1 block text-xs text-danger">Create a category first.</span>}
            </Field>
            <fieldset><legend className="label">Collections</legend>
              {cols.data.map((c) => (
                <label key={c.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" className="check" checked={p.collectionIds.includes(c.id)} onChange={(e) => set('collectionIds', e.target.checked ? [...p.collectionIds, c.id] : p.collectionIds.filter((x) => x !== c.id))} />{c.name}</label>
              ))}
              {!cols.data.length && <p className="text-xs text-taupe-deep">No collections yet.</p>}
            </fieldset>
            <div className="space-y-2">
              {(['featured', 'newArrival', 'bestSeller'] as const).map((k) => (
                <Switch key={k} checked={p[k]} onChange={(v) => set(k, v)} label={{ featured: 'Featured on homepage', newArrival: 'New arrival badge', bestSeller: 'Best seller badge' }[k]} />
              ))}
            </div>
          </Section>
          <Section title="Search appearance" hint="How this product looks in Google results." icon={Search} tone="violet" className="space-y-4">
            <Field label="Meta title"><input className="field" value={p.seo?.title ?? ''} onChange={(e) => set('seo', { ...p.seo, title: e.target.value })} /></Field>
            <Field label="Meta description"><textarea rows={3} className="field" value={p.seo?.description ?? ''} onChange={(e) => set('seo', { ...p.seo, description: e.target.value })} /></Field>
          </Section>
        </aside>
      </fieldset>
    </form>
  )
}
