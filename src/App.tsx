import { Suspense, lazy, useState } from "react"
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { BarChart3, Boxes, ClipboardList, FileText, FolderTree, Gift, Image, LayoutGrid, LogOut, Mail, Menu, MessageSquareQuote, Package, ScrollText, Settings, Shirt, Users, X } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import type { Permission } from './lib/permissions'
import { Spinner, ToastProvider } from './components/ui'
import { LoginPage, NoAccessPage } from './pages/Login'
const L = <T extends Record<string, unknown>>(f: () => Promise<T>, k: keyof T) => lazy(() => f().then((m) => ({ default: m[k] as React.ComponentType })))
const Dashboard = L(() => import("./pages/Dashboard"), "default")
const ProductsPage = L(() => import("./pages/Products"), "ProductsPage")
const ProductEditorPage = L(() => import("./pages/Products"), "ProductEditorPage")
const OrdersPage = L(() => import("./pages/Orders"), "OrdersPage")
const OrderDetailPage = L(() => import("./pages/Orders"), "OrderDetailPage")
const CustomersPage = L(() => import("./pages/Customers"), "default")
const InventoryPage = L(() => import("./pages/Inventory"), "default")
const Analytics = L(() => import("./pages/Analytics"), "default")
const ContentPage = L(() => import("./pages/Content"), "default")
const SettingsPage = L(() => import("./pages/Settings"), "default")
const CategoriesPage = L(() => import("./pages/resources"), "CategoriesPage")
const CollectionsPage = L(() => import("./pages/resources"), "CollectionsPage")
const CouponsPage = L(() => import("./pages/resources"), "CouponsPage")
const BannersPage = L(() => import("./pages/resources"), "BannersPage")
const TestimonialsPage = L(() => import("./pages/resources"), "TestimonialsPage")
const CategoryEditPage = L(() => import("./pages/resources"), "CategoryEditPage")
const CollectionEditPage = L(() => import("./pages/resources"), "CollectionEditPage")
const CouponEditPage = L(() => import("./pages/resources"), "CouponEditPage")
const BannerEditPage = L(() => import("./pages/resources"), "BannerEditPage")
const TestimonialEditPage = L(() => import("./pages/resources"), "TestimonialEditPage")
const InventoryAdjustPage = L(() => import("./pages/Inventory"), "InventoryAdjustPage")
const InventoryHistoryPage = L(() => import("./pages/Inventory"), "InventoryHistoryPage")
const CustomerDetailPage = L(() => import("./pages/Customers"), "CustomerDetailPage")
const NewsletterPage = L(() => import("./pages/Misc"), "NewsletterPage")
const AuditLogsPage = L(() => import("./pages/Misc"), "AuditLogsPage")

const NAV: { to: string; label: string; icon: typeof Package; perm?: Permission }[] = [
  { to: '/', label: 'Overview', icon: LayoutGrid },
  { to: '/orders', label: 'Orders', icon: ClipboardList, perm: 'orders:read' },
  { to: '/products', label: 'Products', icon: Shirt, perm: 'catalog:write' },
  { to: '/categories', label: 'Categories', icon: FolderTree, perm: 'catalog:write' },
  { to: '/collections', label: 'Collections', icon: Package, perm: 'catalog:write' },
  { to: '/inventory', label: 'Inventory', icon: Boxes, perm: 'inventory:write' },
  { to: '/coupons', label: 'Coupons', icon: Gift, perm: 'coupons:write' },
  { to: '/customers', label: 'Customers', icon: Users, perm: 'customers:read' },
  { to: '/content', label: 'Homepage', icon: FileText, perm: 'content:write' },
  { to: '/banners', label: 'Banners', icon: Image, perm: 'content:write' },
  { to: '/testimonials', label: 'Testimonials', icon: MessageSquareQuote, perm: 'content:write' },
  { to: '/newsletter', label: 'Newsletter', icon: Mail, perm: 'roles:manage' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, perm: 'analytics:read' },
  { to: '/settings', label: 'Settings', icon: Settings, perm: 'content:write' },
  { to: '/audit-logs', label: 'Audit log', icon: ScrollText, perm: 'audit:read' },
]

const GROUPS: { title: string; paths: string[] }[] = [
  { title: 'Overview', paths: ['/'] },
  { title: 'Sales', paths: ['/orders', '/customers', '/coupons'] },
  { title: 'Catalogue', paths: ['/products', '/categories', '/collections', '/inventory'] },
  { title: 'Storefront', paths: ['/content', '/banners', '/testimonials', '/newsletter', '/settings'] },
  { title: 'Insights', paths: ['/analytics', '/audit-logs'] },
]

const COLORS: Record<string, string> = {
  '/': '#f472b6', '/orders': '#38bdf8', '/customers': '#a78bfa', '/coupons': '#fbbf24', '/products': '#f472b6', '/categories': '#34d399',
  '/collections': '#fb923c', '/inventory': '#22d3ee', '/content': '#a78bfa', '/banners': '#f472b6', '/testimonials': '#fbbf24',
  '/newsletter': '#38bdf8', '/settings': '#94a3b8', '/analytics': '#34d399', '/audit-logs': '#fb7185',
}

function Shell() {
  const loc = useLocation()
  const { user, role, can, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const items = NAV.filter((n) => !n.perm || can(n.perm))
  const initial = (user?.email ?? '?')[0].toUpperCase()
  const nav = (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {GROUPS.map((g) => {
        const links = g.paths.map((p) => items.find((i) => i.to === p)).filter((x): x is (typeof items)[number] => !!x)
        if (!links.length) return null
        return (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-ivory/35">{g.title}</p>
            <div className="space-y-0.5">
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
                  style={{ ['--c' as string]: COLORS[to] }} className="nav-link flex items-center gap-3 rounded-xl px-2 py-1.5 text-[0.84rem] font-medium text-ivory/75 hover:bg-ivory/5 hover:text-white">
                  <span className="nav-ico" style={{ color: COLORS[to] }}><Icon size={16} strokeWidth={1.9} /></span>{label}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
  const profile = (
    <div className="border-t border-ivory/10 p-3">
      <div className="flex items-center gap-3 rounded-lg p-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#f472b6,#7c5cff)" }}>{initial}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-[0.8rem] font-medium text-white">{user?.email}</p><p className="text-xs capitalize text-ivory/50">{role}</p></div>
        <button onClick={() => logout()} aria-label="Sign out" title="Sign out" className="grid h-8 w-8 place-items-center rounded-lg text-ivory/60 hover:bg-ivory/10 hover:text-white"><LogOut size={16} /></button>
      </div>
    </div>
  )
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="side sticky top-0 hidden h-screen flex-col lg:flex">
        <div className="flex justify-center px-6 pb-2 pt-6"><img src="/brand/logo-full-light.png" alt="Ze Bella" className="w-28" /></div>
        {nav}
        {profile}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-espresso px-4 lg:hidden">
        <img src="/brand/logo-wordmark-light.png" alt="Ze Bella" className="h-4" />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center text-ivory"><Menu /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-espresso/60" onClick={() => setOpen(false)} />
          <div className="side absolute inset-y-0 left-0 flex w-72 flex-col">
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="ml-auto grid h-12 w-12 place-items-center text-ivory"><X /></button>
            {nav}
            {profile}
          </div>
        </div>
      )}
      <main className="min-w-0 p-4 sm:p-8"><div className="mx-auto max-w-7xl"><Suspense fallback={<Spinner />}><div key={loc.pathname} className="page"><Outlet /></div></Suspense></div></main>
    </div>
  )
}

function Gate() {
  const { user, role, ready } = useAuth()
  if (!ready) return <Spinner />
  if (!user) return <LoginPage />
  if (!role) return <NoAccessPage />
  return <Shell />
}

/** Route-level permission check (UI only — data access is enforced by Firestore rules and the server APIs). */
function Need({ perm, children }: { perm: Permission; children: React.ReactNode }) {
  const { can } = useAuth()
  return can(perm) ? <>{children}</> : <p className="card text-sm">Your role does not include access to this section.</p>
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Gate />}>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<Need perm="orders:read"><OrdersPage /></Need>} />
              <Route path="orders/:id" element={<Need perm="orders:read"><OrderDetailPage /></Need>} />
              <Route path="products" element={<Need perm="catalog:write"><ProductsPage /></Need>} />
              <Route path="products/new" element={<Need perm="catalog:write"><ProductEditorPage /></Need>} />
              <Route path="products/:id" element={<Need perm="catalog:write"><ProductEditorPage /></Need>} />
              <Route path="categories" element={<Need perm="catalog:write"><CategoriesPage /></Need>} />
              <Route path="categories/new" element={<Need perm="catalog:write"><CategoryEditPage /></Need>} />
              <Route path="categories/:id" element={<Need perm="catalog:write"><CategoryEditPage /></Need>} />
              <Route path="collections" element={<Need perm="catalog:write"><CollectionsPage /></Need>} />
              <Route path="collections/new" element={<Need perm="catalog:write"><CollectionEditPage /></Need>} />
              <Route path="collections/:id" element={<Need perm="catalog:write"><CollectionEditPage /></Need>} />
              <Route path="inventory" element={<Need perm="inventory:write"><InventoryPage /></Need>} />
              <Route path="inventory/:pid/adjust" element={<Need perm="inventory:write"><InventoryAdjustPage /></Need>} />
              <Route path="inventory/:pid/history" element={<Need perm="inventory:write"><InventoryHistoryPage /></Need>} />
              <Route path="coupons" element={<Need perm="coupons:write"><CouponsPage /></Need>} />
              <Route path="coupons/new" element={<Need perm="coupons:write"><CouponEditPage /></Need>} />
              <Route path="coupons/:id" element={<Need perm="coupons:write"><CouponEditPage /></Need>} />
              <Route path="customers" element={<Need perm="customers:read"><CustomersPage /></Need>} />
              <Route path="customers/:uid" element={<Need perm="customers:read"><CustomerDetailPage /></Need>} />
              <Route path="content" element={<Need perm="content:write"><ContentPage /></Need>} />
              <Route path="banners" element={<Need perm="content:write"><BannersPage /></Need>} />
              <Route path="banners/new" element={<Need perm="content:write"><BannerEditPage /></Need>} />
              <Route path="banners/:id" element={<Need perm="content:write"><BannerEditPage /></Need>} />
              <Route path="testimonials" element={<Need perm="content:write"><TestimonialsPage /></Need>} />
              <Route path="testimonials/new" element={<Need perm="content:write"><TestimonialEditPage /></Need>} />
              <Route path="testimonials/:id" element={<Need perm="content:write"><TestimonialEditPage /></Need>} />
              <Route path="newsletter" element={<Need perm="roles:manage"><NewsletterPage /></Need>} />
              <Route path="analytics" element={<Need perm="analytics:read"><Analytics /></Need>} />
              <Route path="settings" element={<Need perm="content:write"><SettingsPage /></Need>} />
              <Route path="audit-logs" element={<Need perm="audit:read"><AuditLogsPage /></Need>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
