import { createContext, useContext, useState, type ReactNode } from 'react'
import { CalendarDays, ChevronDown, Download, Loader2 } from 'lucide-react'
import { resolveRange, ymd, type Range, type RangeSel } from '../lib/reports'
import { exportXlsx, type Col, type ColType, type SheetDef } from '../lib/excel'
import { formatINR, fmtDate } from '../lib/util'
import { useToast } from './ui'

/* ---------- context so every card can name its Excel file after the period ---------- */
export const ReportCtx = createContext<{ range: Range; scope: string }>({ range: resolveRange({ preset: 'month', from: '', to: '' }), scope: 'report' })
const useCtx = () => useContext(ReportCtx)

const stamp = (r: Range) => `${ymd(r.from)}_to_${ymd(r.to)}`
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function useExport() {
  const { range, scope } = useCtx()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (title: string, sheets: SheetDef[]) => {
    setBusy(true)
    try { await exportXlsx(`zebella-${slug(scope)}-${slug(title)}-${stamp(range)}`, sheets, { title: `${scope} — ${title}`, period: range.label }); toast('Excel downloaded') }
    catch { toast('Could not create the Excel file', 'error') } finally { setBusy(false) }
  }
  return { busy, run }
}

export function ExportButton({ title, sheets, label = 'Excel', solid = false }: { title: string; sheets: SheetDef[]; label?: string; solid?: boolean }) {
  const { busy, run } = useExport()
  return (
    <button type="button" disabled={busy} onClick={() => void run(title, sheets)} className={`btn btn-sm ${solid ? 'btn-solid' : ''}`} title="Download as Excel">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}{label}
    </button>
  )
}

/* ---------- date range bar ---------- */
const PRESETS: { v: RangeSel['preset']; l: string }[] = [{ v: 'today', l: 'Today' }, { v: 'week', l: 'This week' }, { v: 'month', l: 'This month' }, { v: 'year', l: 'This year' }, { v: 'custom', l: 'Custom' }]
export function DateRangeBar({ sel, onChange, range, right }: { sel: RangeSel; onChange(s: RangeSel): void; range: Range; right?: ReactNode }) {
  const today = ymd(Date.now())
  return (
    <div className="card sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-3 !p-3">
      <CalendarDays size={16} className="ml-1 text-gold-deep" />
      <div role="group" aria-label="Date range" className="flex flex-wrap gap-1 rounded-full bg-[#f4ece8] p-1">
        {PRESETS.map((p) => (
          <button key={p.v} type="button" aria-pressed={sel.preset === p.v}
            onClick={() => onChange(p.v === 'custom' ? { preset: 'custom', from: sel.from || ymd(range.from), to: sel.to || ymd(range.to) } : { ...sel, preset: p.v })}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${sel.preset === p.v ? 'bg-espresso text-[#f3e3c3] shadow' : 'text-taupe-deep hover:text-ink'}`}>{p.l}</button>
        ))}
      </div>
      {sel.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input aria-label="From date" type="date" className="field !min-h-9 !w-auto !py-1" max={today} value={sel.from} onChange={(e) => onChange({ ...sel, from: e.target.value })} />
          <span className="text-taupe-deep">to</span>
          <input aria-label="To date" type="date" className="field !min-h-9 !w-auto !py-1" max={today} min={sel.from} value={sel.to} onChange={(e) => onChange({ ...sel, to: e.target.value })} />
        </div>
      )}
      <p className="text-xs text-taupe-deep"><b className="text-ink">{range.label}</b></p>
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </div>
  )
}

/* ---------- data table (also the Excel layout) ---------- */
const fmt = (v: string | number | null | undefined, t: ColType = 'text') => {
  if (v == null || v === '') return '—'
  if (typeof v === 'string') return v
  switch (t) {
    case 'inr': return formatINR(v)
    case 'int': return v.toLocaleString('en-IN')
    case 'dec': return v.toLocaleString('en-IN', { maximumFractionDigits: 1 })
    case 'pct': return `${v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`
    case 'date': return v ? fmtDate(v) : '—'
    default: return String(v)
  }
}
const numeric = (t?: ColType) => t === 'int' || t === 'inr' || t === 'pct' || t === 'dec'

export function DataSheet<T>({ sheet, rows = 8, empty = 'No data for this period.', badge }: { sheet: SheetDef<T>; rows?: number; empty?: string; badge?: (col: Col<T>, row: T) => ReactNode }) {
  const [all, setAll] = useState(false)
  const list = all ? sheet.rows : sheet.rows.slice(0, rows)
  if (!sheet.rows.length) return <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-taupe-deep">{empty}</p>
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-max text-left text-[0.82rem]">
          <thead><tr>{sheet.cols.map((c) => <th key={c.header} className={`th ${numeric(c.type) ? '!text-right' : ''}`}>{c.header}</th>)}</tr></thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={i} className="hover:bg-ivory/70">
                {sheet.cols.map((c) => <td key={c.header} className={`td ${numeric(c.type) ? 'text-right tabular-nums' : ''}`}>{badge?.(c, r) ?? fmt(c.value(r), c.type)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheet.rows.length > rows && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold-deep hover:underline">
          <ChevronDown size={13} className={all ? 'rotate-180' : ''} />{all ? 'Show less' : `Show all ${sheet.rows.length.toLocaleString('en-IN')} rows`}
        </button>
      )}
    </div>
  )
}

/* ---------- a report = title + chart + table + Excel ---------- */
export function ReportCard<T>({ title, hint, sheet, children, className = '', rows, empty, badge, aside }: { title: string; hint?: string; sheet: SheetDef<T>; children?: ReactNode; className?: string; rows?: number; empty?: string; badge?: (col: Col<T>, row: T) => ReactNode; aside?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="card-title">{title}</h2>{hint && <p className="mt-0.5 text-xs text-taupe-deep">{hint}</p>}</div>
        <div className="flex items-center gap-2">{aside}<ExportButton title={title} sheets={[sheet as SheetDef]} /></div>
      </div>
      {children && <div className="mb-4">{children}</div>}
      <DataSheet sheet={sheet} rows={rows} empty={empty} badge={badge} />
    </section>
  )
}

export const Notice = ({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) => (
  <p className={`mb-4 rounded-xl border px-3.5 py-2.5 text-sm ${tone === 'warn' ? 'border-champagne/50 bg-gold-soft text-gold-deep' : 'border-line bg-white/70 text-taupe-deep'}`}>{children}</p>
)

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-10 text-center text-sm text-taupe-deep">{children}</p>

/** Heat-shaded size × colour table. */
export function Matrix({ sizes, colors, cell }: { sizes: string[]; colors: string[]; cell(s: string, c: string): number }) {
  const max = Math.max(1, ...sizes.flatMap((s) => colors.map((c) => cell(s, c))))
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-max text-center text-[0.82rem]">
        <thead><tr><th className="th">Size \ Colour</th>{colors.map((c) => <th key={c} className="th !text-center">{c}</th>)}<th className="th !text-center">Total</th></tr></thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={s}>
              <td className="td text-left font-semibold">{s}</td>
              {colors.map((c) => { const v = cell(s, c); return <td key={c} className="td tabular-nums" style={{ background: v ? `rgba(143,58,85,${0.06 + (v / max) * 0.5})` : undefined, color: v / max > 0.55 ? '#fff' : undefined }}>{v || <span className="text-taupe">0</span>}</td> })}
              <td className="td font-semibold tabular-nums">{colors.reduce((n, c) => n + cell(s, c), 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
