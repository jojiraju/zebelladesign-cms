import { Download } from 'lucide-react'
import { limit, orderBy } from 'firebase/firestore'
import { useDocs, type Doc } from '../lib/hooks'
import { fmtDate } from '../lib/util'
import { Badge, ErrorBox, PageHeader } from '../components/ui'
import { DataTable, type TableColumn } from '../components/DataTable'

interface Sub { email: string; createdAt: number; source?: string }
const subCons = [orderBy('createdAt', 'desc'), limit(1000)]

const subCols: TableColumn<Doc<Sub>>[] = [
  { name: 'Email', sortable: true, selector: (s) => s.email, grow: 2, cell: (s) => <span className="font-medium">{s.email}</span> },
  { name: 'Source', sortable: true, selector: (s) => s.source ?? '', cell: (s) => (s.source ? <Badge>{s.source}</Badge> : '—') },
  { name: 'Subscribed', sortable: true, selector: (s) => s.createdAt, grow: 1.2, cell: (s) => fmtDate(s.createdAt) },
]

export function NewsletterPage() {
  const { data, loading, error } = useDocs<Sub>('newsletterSubscribers', subCons)
  const exportCsv = () => {
    const csv = ['email,subscribed_at,source', ...data.map((s) => `"${s.email.replace(/"/g, '""')}",${new Date(s.createdAt).toISOString()},${s.source ?? ''}`)].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'zebella-subscribers.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div>
      <PageHeader title="Newsletter" subtitle="Every address here was stored with the visitor's explicit consent." actions={<button className="btn" disabled={!data.length} onClick={exportCsv}><Download size={15} />Export CSV</button>} />
      {error && <ErrorBox message={error} />}
      <DataTable columns={subCols} data={data} loading={loading} searchText={(s) => s.email} searchPlaceholder="Search email" perPage={25} empty="No subscribers yet." />
    </div>
  )
}

interface Log { actor: string; actorEmail?: string | null; action: string; target: string; detail?: unknown; createdAt: number }
const logCons = [orderBy('createdAt', 'desc'), limit(200)]

const logCols: TableColumn<Doc<Log>>[] = [
  { id: 'when', name: 'When', sortable: true, selector: (l) => l.createdAt, minWidth: '170px', cell: (l) => <span className="whitespace-nowrap text-taupe-deep">{fmtDate(l.createdAt)}</span> },
  { name: 'Who', sortable: true, selector: (l) => l.actorEmail ?? l.actor, grow: 1.4, minWidth: '180px', cell: (l) => l.actorEmail ?? l.actor },
  { name: 'Action', sortable: true, selector: (l) => l.action, grow: 1.3, minWidth: '170px', cell: (l) => <Badge tone="brand">{l.action}</Badge> },
  { name: 'Target', selector: (l) => l.target, grow: 1.4, minWidth: '160px', wrap: true, cell: (l) => <span className="break-all">{l.target}</span> },
  { name: 'Detail', grow: 2, minWidth: '180px', wrap: true, cell: (l) => <span className="text-xs text-taupe-deep">{l.detail ? JSON.stringify(l.detail) : ''}</span> },
]

export function AuditLogsPage() {
  const { data, loading, error } = useDocs<Log>('adminAuditLogs', logCons)
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Append-only record of sensitive admin actions (latest 200)." />
      {error && <ErrorBox message={error} />}
      <DataTable columns={logCols} data={data} loading={loading} searchText={(l) => `${l.actorEmail ?? l.actor} ${l.action} ${l.target}`} searchPlaceholder="Search who, action or target" defaultSortFieldId="when" defaultSortAsc={false} empty="No activity recorded yet." />
    </div>
  )
}
