import { useMemo, useState, type ReactNode } from 'react'
import RDT, { type TableColumn, type TableStyles } from 'react-data-table-component'
import { Search } from 'lucide-react'
import { Spinner } from './ui'

export type { TableColumn }

const styles: TableStyles = {
  table: { style: { backgroundColor: 'transparent' } },
  headRow: { style: { minHeight: '44px', backgroundColor: '#fbf8f9', borderBottom: '1px solid #ebe2e4' } },
  headCells: { style: { fontSize: '.7rem', fontWeight: 600, color: '#6b5c62', textTransform: 'uppercase', letterSpacing: '.06em', paddingLeft: '16px', paddingRight: '8px' } },
  rows: {
    style: { minHeight: '58px', fontSize: '.86rem', color: '#2b2124', backgroundColor: 'transparent', borderBottomColor: '#f1e9eb' },
    highlightOnHoverStyle: { backgroundColor: '#fbf6f7', outline: 'none', transitionDuration: '0.1s', borderBottomColor: '#f1e9eb' },
  },
  cells: { style: { paddingLeft: '16px', paddingRight: '8px', paddingTop: '8px', paddingBottom: '8px' } },
  pagination: { style: { borderTop: '1px solid #ebe2e4', fontSize: '.8rem', minHeight: '54px', color: '#6b5c62', backgroundColor: '#fff' } },
}

interface Props<T> {
  columns: TableColumn<T>[]
  data: T[]
  loading?: boolean
  /** Text used by the built-in search box. Omit to hide search. */
  searchText?(row: T): string
  searchPlaceholder?: string
  /** Extra controls (selects, toggles) shown beside the search box. */
  filters?: ReactNode
  /** Shown when there are no rows. */
  empty?: ReactNode
  onRowClicked?(row: T): void
  perPage?: number
  /** Set false for short, fixed lists (e.g. dashboard panels). */
  paginate?: boolean
  defaultSortFieldId?: string
  defaultSortAsc?: boolean
}

/** Themed react-data-table-component with search, sorting and pagination built in. */
export function DataTable<T>({ columns, data, loading, searchText, searchPlaceholder = 'Search…', filters, empty, onRowClicked, perPage = 10, paginate = true, defaultSortFieldId, defaultSortAsc = true }: Props<T>) {
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle && searchText ? data.filter((r) => searchText(r).toLowerCase().includes(needle)) : data
  }, [data, q, searchText])

  return (
    <div>
      {(searchText || filters) && (
        <div className="toolbar">
          {searchText && (
            <div className="relative w-full sm:w-80">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taupe" />
              <input className="field !pl-9" type="search" placeholder={searchPlaceholder} aria-label={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          {filters}
          <span className="ml-auto text-xs text-taupe-deep">{rows.length} {rows.length === 1 ? 'result' : 'results'}</span>
        </div>
      )}
      <div className="dt-wrap">
        <RDT<T>
          columns={columns} data={rows} customStyles={styles} progressPending={!!loading} progressComponent={<Spinner />}
          pagination={paginate} paginationPerPage={perPage} paginationRowsPerPageOptions={[10, 25, 50, 100]}
          highlightOnHover pointerOnHover={!!onRowClicked} onRowClicked={onRowClicked}
          defaultSortFieldId={defaultSortFieldId} defaultSortAsc={defaultSortAsc}
          noDataComponent={<div className="px-4 py-14 text-center text-sm text-taupe-deep">{empty ?? 'Nothing to show.'}</div>}
        />
      </div>
    </div>
  )
}
