import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList, Eye, Search, ShieldCheck } from 'lucide-react'
import { db } from '../lib/firebase'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { errMsg, fmtDate, formatINR } from '../lib/util'
import { Badge, ErrorBox, IconButton, PageHeader, Section, useToast } from '../components/ui'
import { DataTable, type TableColumn } from '../components/DataTable'
import type { Order } from './Orders'

interface Customer { uid: string; email: string | null; name: string | null; verified: boolean; createdAt: string; lastSignIn: string; role: string | null }

const day = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN') : '—')
const Avatar = ({ c, size = 9 }: { c: Customer; size?: number }) => (
  <div className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem`, background: 'linear-gradient(135deg,#f472b6,#7c5cff)' }}>{(c.name ?? c.email ?? '?')[0].toUpperCase()}</div>
)

/** Shared role change used by the list and the detail page. */
function useRoleChange(onDone: (uid: string, role: string | null) => void) {
  const toast = useToast()
  return async (c: Customer, role: string | null) => {
    if (!window.confirm(`${role ? `Grant "${role}" access to` : 'Remove staff access from'} ${c.email}? They must sign in again to apply it.`)) return
    try { await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ uid: c.uid, role }) }); toast('Role updated'); onDone(c.uid, role) } catch (e) { toast(errMsg(e), 'error') }
  }
}

const RoleSelect = ({ c, onPick }: { c: Customer; onPick(role: string): void }) => (
  <select aria-label={`Grant role to ${c.email}`} className="field !min-h-8 !w-auto !py-0 text-xs" value="" onClick={(e) => e.stopPropagation()} onChange={(e) => e.target.value && onPick(e.target.value)}>
    <option value="">Grant role…</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="fulfillment">Fulfilment</option>
  </select>
)

/* ============================== list ============================== */
export default function CustomersPage() {
  const { can } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Customer[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const setRole = useRoleChange((uid, role) => setRows((r) => r?.map((x) => (x.uid === uid ? { ...x, role } : x)) ?? r))
  const open = (c: Customer) => nav(`/customers/${c.uid}`, { state: { customer: c } })

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ users: Customer[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`).then((r) => { setRows(r.users); setErr(null) }).catch((e) => setErr(errMsg(e)))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const columns: TableColumn<Customer>[] = [
    { id: 'name', name: 'Customer', sortable: true, selector: (c) => c.name ?? c.email ?? '', grow: 2, minWidth: '220px', cell: (c) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar c={c} />
        <div className="min-w-0"><p className="truncate font-medium">{c.name ?? '—'}</p><p className="truncate text-xs text-taupe-deep">{c.email}{c.verified ? '' : ' (unverified)'}</p></div>
      </div>) },
    { id: 'joined', name: 'Joined', sortable: true, selector: (c) => (c.createdAt ? Date.parse(c.createdAt) : 0), minWidth: '120px', cell: (c) => day(c.createdAt) },
    { id: 'last', name: 'Last sign-in', sortable: true, selector: (c) => (c.lastSignIn ? Date.parse(c.lastSignIn) : 0), minWidth: '120px', cell: (c) => day(c.lastSignIn) },
    { id: 'role', name: 'Role', sortable: true, selector: (c) => c.role ?? 'customer', minWidth: '110px', cell: (c) => (c.role ? <Badge tone="brand">{c.role}</Badge> : <span className="text-taupe-deep">customer</span>) },
    { name: '', right: true, grow: 1.2, minWidth: '230px', cell: (c) => (
      <div className="flex items-center gap-2">
        <IconButton label="View customer & orders" tone="brand" to={`/customers/${c.uid}`}><Eye size={15} /></IconButton>
        {can('roles:manage') && (c.role
          ? <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); void setRole(c, null) }}>Remove role</button>
          : <RoleSelect c={c} onPick={(r) => void setRole(c, r)} />)}
      </div>) },
  ]

  return (
    <div>
      <PageHeader title="Customers" subtitle="Accounts registered on the storefront. Passwords and tokens are never shown." />
      {err && <ErrorBox message={err} />}
      <div className="relative mb-4 w-full sm:w-80">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taupe" />
        <input className="field !pl-9" type="search" placeholder="Search by name or email" aria-label="Search customers" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <DataTable columns={columns} data={rows ?? []} loading={!rows} onRowClicked={open} empty="No customers found." />
    </div>
  )
}

/* ============================== detail (page) ============================== */
const orderCols: TableColumn<Order>[] = [
  { name: 'Order', sortable: true, selector: (o) => o.id, grow: 1.4, minWidth: '150px', cell: (o) => <Link className="link" to={`/orders/${o.id}`}>{o.id}</Link> },
  { id: 'placed', name: 'Placed', sortable: true, selector: (o) => o.createdAt, grow: 1.3, minWidth: '160px', cell: (o) => fmtDate(o.createdAt) },
  { name: 'Payment', cell: (o) => <Badge tone={o.paymentStatus === 'paid' ? 'ok' : o.paymentStatus === 'failed' ? 'bad' : 'warn'}>{o.paymentStatus.replace(/_/g, ' ')}</Badge> },
  { name: 'Total', right: true, sortable: true, selector: (o) => o.total, cell: (o) => <b>{formatINR(o.total)}</b> },
]

export function CustomerDetailPage() {
  const { uid } = useParams()
  const { can } = useAuth()
  const stateCustomer = (useLocation().state as { customer?: Customer } | null)?.customer
  const [c, setC] = useState<Customer | null>(stateCustomer ?? null)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const setRole = useRoleChange((_, role) => setC((x) => (x ? { ...x, role } : x)))

  useEffect(() => {
    getDocs(query(collection(db, 'orders'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(100)))
      .then((s) => setOrders(s.docs.map((d) => ({ ...(d.data() as Order), id: d.id })))).catch((e) => setErr(errMsg(e)))
  }, [uid])

  // Opened directly (no router state): look the account up by the e-mail on its first order.
  useEffect(() => {
    if (c || !orders?.[0]?.email) return
    api<{ users: Customer[] }>(`/api/admin/users?q=${encodeURIComponent(orders[0].email)}`).then((r) => setC(r.users.find((u) => u.uid === uid) ?? null)).catch(() => undefined)
  }, [c, orders, uid])

  const spent = (orders ?? []).filter((o) => o.paymentStatus === 'paid').reduce((n, o) => n + o.total, 0)
  const back = <Link to="/customers" className="link inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} />All customers</Link>

  return (
    <div>
      <PageHeader title={c?.name ?? c?.email ?? 'Customer'} subtitle={c?.name ? c.email ?? undefined : `Account ${uid}`} back={back} />
      {err && <ErrorBox message={err} />}
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-6">
          <section className="card text-center">
            {c && <div className="mx-auto mb-3 w-fit"><Avatar c={c} size={16} /></div>}
            <p className="font-serif text-lg font-bold">{c?.name ?? '—'}</p>
            <p className="break-all text-sm text-taupe-deep">{c?.email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {c && <Badge tone={c.verified ? 'ok' : 'warn'}>{c.verified ? 'Verified' : 'Unverified'}</Badge>}
              <Badge tone={c?.role ? 'brand' : 'neutral'}>{c?.role ?? 'customer'}</Badge>
            </div>
            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-left text-sm">
              <div className="flex justify-between"><dt className="text-taupe-deep">Joined</dt><dd>{day(c?.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-taupe-deep">Last sign-in</dt><dd>{day(c?.lastSignIn)}</dd></div>
              <div className="flex justify-between"><dt className="text-taupe-deep">Orders</dt><dd>{orders?.length ?? '…'}</dd></div>
              <div className="flex justify-between"><dt className="text-taupe-deep">Paid total</dt><dd className="font-semibold">{formatINR(spent)}</dd></div>
            </dl>
          </section>
          {c && can('roles:manage') && (
            <Section title="Staff access" hint="Staff must sign in again for a change to apply." icon={ShieldCheck} tone="violet">
              {c.role
                ? <button className="btn btn-danger w-full" onClick={() => void setRole(c, null)}>Remove “{c.role}” access</button>
                : <RoleSelect c={c} onPick={(r) => void setRole(c, r)} />}
            </Section>
          )}
        </div>
        <Section title="Orders" hint="Most recent first." icon={ClipboardList} tone="sky">
          <DataTable<Order> columns={orderCols} data={orders ?? []} loading={!orders} paginate={(orders?.length ?? 0) > 10} defaultSortFieldId="placed" empty="No orders yet." />
        </Section>
      </div>
    </div>
  )
}
