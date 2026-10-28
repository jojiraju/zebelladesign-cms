import { Badge } from '../components/ui'
import { ResourceEditor, ResourceManager, dateCol, type ResourceConfig } from '../components/ResourceManager'
import { formatINR } from '../lib/util'

const visibility = (v: unknown) => (v ? <Badge tone="ok">Visible</Badge> : <Badge>Hidden</Badge>)
const status = (v: unknown) => (v === 'published' ? <Badge tone="ok">Published</Badge> : <Badge>Draft</Badge>)

const category: ResourceConfig = {
  collection: 'categories', path: '/categories', title: 'Categories', singular: 'Category', permission: 'catalog:write', orderBy: 'order',
  description: 'Shown in the storefront navigation and category pages.',
  defaults: { name: '', slug: '', description: '', imageUrl: '', order: 0, visible: true, seoTitle: '', seoDescription: '' },
  slugFrom: 'name', idFrom: 'slug',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'slug', label: 'URL slug', type: 'text', required: true, hint: 'Lower-case, used in /categories/<slug>. Cannot change after creation.' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'imageUrl', label: 'Image', type: 'image', folder: 'categories' },
    { key: 'order', label: 'Display order', type: 'number' },
    { key: 'visible', label: 'Visible on storefront', type: 'bool' },
    { key: 'seoTitle', label: 'SEO title', type: 'text' },
    { key: 'seoDescription', label: 'SEO description', type: 'textarea' },
  ],
  columns: [{ key: 'order', label: '#' }, { key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' }, { key: 'visible', label: 'Status', render: visibility }],
}

const collectionCfg: ResourceConfig = {
  ...category, collection: 'collections', path: '/collections', title: 'Collections', singular: 'Collection',
  description: 'Curated groupings (e.g. Festive Wear). Assign products to collections in the product editor.',
  fields: [...category.fields.slice(0, 5), { key: 'featured', label: 'Featured', type: 'bool' }, ...category.fields.slice(5)],
  defaults: { ...category.defaults, featured: false },
}

const banners: ResourceConfig = {
  collection: 'banners', path: '/banners', title: 'Banners', singular: 'Banner', permission: 'content:write', orderBy: 'order',
  description: 'Promotional editorial banners on the homepage. Only published banners inside their date range are shown.',
  defaults: { heading: '', description: '', ctaLabel: '', href: '', desktopImage: '', mobileImage: '', status: 'draft', startsAt: '', endsAt: '', order: 0 },
  fields: [
    { key: 'heading', label: 'Heading', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'ctaLabel', label: 'Button label', type: 'text' },
    { key: 'href', label: 'Destination URL', type: 'text', hint: 'e.g. /collections/festive-wear' },
    { key: 'desktopImage', label: 'Desktop image', type: 'image', folder: 'content/banners' },
    { key: 'mobileImage', label: 'Mobile image', type: 'image', folder: 'content/banners' },
    { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['published', 'Published']] },
    { key: 'order', label: 'Order', type: 'number' },
    { key: 'startsAt', label: 'Starts', type: 'datetime' },
    { key: 'endsAt', label: 'Ends', type: 'datetime' },
  ],
  columns: [{ key: 'heading', label: 'Heading' }, { key: 'status', label: 'Status', render: status }, { key: 'startsAt', label: 'Starts', render: dateCol }, { key: 'endsAt', label: 'Ends', render: dateCol }],
}

const testimonials: ResourceConfig = {
  collection: 'testimonials', path: '/testimonials', title: 'Testimonials', singular: 'Testimonial', permission: 'content:write',
  description: 'Only add genuine reviews from real customers. Unverified testimonials are never shown on the storefront.',
  defaults: { name: '', location: '', quote: '', verified: false, status: 'draft' },
  fields: [
    { key: 'name', label: 'Customer name', type: 'text', required: true },
    { key: 'location', label: 'City (optional)', type: 'text' },
    { key: 'quote', label: 'Review', type: 'textarea', required: true },
    { key: 'verified', label: 'I have verified this is from a real purchasing customer', type: 'bool' },
    { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['published', 'Published']] },
  ],
  columns: [{ key: 'name', label: 'Customer' }, { key: 'verified', label: 'Verified', render: (v) => (v ? <Badge tone="ok">Verified</Badge> : <Badge tone="warn">Unverified</Badge>) }, { key: 'status', label: 'Status', render: status }],
}

const coupons: ResourceConfig = {
  collection: 'coupons', path: '/coupons', title: 'Coupons', singular: 'Coupon', permission: 'coupons:write', revalidate: false,
  description: 'All validation and discount maths happens on the server at checkout.',
  defaults: { code: '', type: 'percent', value: '', minOrder: '', maxDiscount: '', startsAt: '', endsAt: '', usageLimit: '', perUserLimit: '', productIds: [], collectionIds: [], active: true },
  // The form edits fixed discounts in rupees; the server engine stores/reads paise.
  beforeSave: (b) => {
    const v = Number(b.value) || 0
    if (b.type === 'percent' && (v <= 0 || v > 100)) throw new Error('Percentage must be between 1 and 100.')
    if (b.type === 'fixed' && v <= 0) throw new Error('Enter a fixed discount above zero.')
    return { ...b, value: b.type === 'fixed' ? Math.round(v * 100) : v }
  },
  onCreate: { usedCount: 0 }, // set once; never overwritten by later edits (the server increments it)
  afterLoad: (f, row) => (row.type === 'fixed' ? { ...f, value: Number(row.value) / 100 } : f),
  fields: [
    { key: 'code', label: 'Code', type: 'text', required: true, upper: true },
    { key: 'type', label: 'Type', type: 'select', options: [['percent', 'Percentage (%)'], ['fixed', 'Fixed amount (₹)']] },
    { key: 'value', label: 'Value (% or ₹)', type: 'number', required: true, hint: 'For fixed coupons enter rupees; it is stored in paise.' },
    { key: 'minOrder', label: 'Minimum order (₹)', type: 'money' },
    { key: 'maxDiscount', label: 'Maximum discount (₹)', type: 'money' },
    { key: 'startsAt', label: 'Starts', type: 'datetime' },
    { key: 'endsAt', label: 'Ends', type: 'datetime' },
    { key: 'usageLimit', label: 'Total usage limit', type: 'number' },
    { key: 'perUserLimit', label: 'Per-customer limit', type: 'number' },
    { key: 'productIds', label: 'Restrict to product IDs', type: 'idlist', hint: 'Comma-separated. Leave empty for all products.' },
    { key: 'collectionIds', label: 'Restrict to collection IDs', type: 'idlist', hint: 'Comma-separated. Leave empty for all.' },
    { key: 'active', label: 'Active', type: 'bool' },
  ],
  columns: [
    { key: 'code', label: 'Code' },
    { key: 'value', label: 'Discount', render: (v, r) => (r.type === 'percent' ? `${v}%` : formatINR(Number(v))) },
    { key: 'usedCount', label: 'Used' }, { key: 'endsAt', label: 'Ends', render: dateCol },
    { key: 'active', label: 'State', render: (v) => (v ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>) },
  ],
}

export const CategoriesPage = () => <ResourceManager cfg={category} />
export const CollectionsPage = () => <ResourceManager cfg={collectionCfg} />
export const BannersPage = () => <ResourceManager cfg={banners} />
export const TestimonialsPage = () => <ResourceManager cfg={testimonials} />
export const CouponsPage = () => <ResourceManager cfg={coupons} />
export const CategoryEditPage = () => <ResourceEditor cfg={category} />
export const CollectionEditPage = () => <ResourceEditor cfg={collectionCfg} />
export const BannerEditPage = () => <ResourceEditor cfg={banners} />
export const TestimonialEditPage = () => <ResourceEditor cfg={testimonials} />
export const CouponEditPage = () => <ResourceEditor cfg={coupons} />
