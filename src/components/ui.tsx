import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Inbox, Loader2, X, type LucideIcon } from 'lucide-react'

export function PageHeader({ title, subtitle, actions, sticky = false, back }: { title: string; subtitle?: string; actions?: ReactNode; sticky?: boolean; back?: ReactNode }) {
  return (
    <div className={sticky ? 'sticky top-14 z-20 -mx-4 mb-6 border-b border-line/70 bg-canvas/85 px-4 py-3 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-0' : 'mb-6'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {back && <div className="mb-1.5">{back}</div>}
          <h1 className="flex items-center gap-3 text-2xl leading-tight sm:text-[1.7rem]"><span className="h-7 w-1.5 rounded-full" style={{ background: 'linear-gradient(180deg,#f472b6,#7c5cff)' }} />{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-taupe-deep">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export const Spinner = () => <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-gold-deep" size={26} /></div>

export function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-red-50 p-3 text-sm text-danger">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />{message}
    </p>
  )
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="card py-14 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-gold-soft text-gold-deep"><Inbox size={22} /></div>
      <p className="font-serif text-lg font-bold">{title}</p>
      {text && <p className="mx-auto mt-1.5 max-w-md text-sm text-taupe-deep">{text}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}

const TONES: Record<string, string> = {
  ok: 'bg-emerald-50 text-ok ring-emerald-600/20', warn: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  bad: 'bg-red-50 text-danger ring-red-600/20', neutral: 'bg-stone-100 text-taupe-deep ring-stone-400/20',
  brand: 'bg-gold-soft text-gold-deep ring-gold-deep/20',
}
export const Badge = ({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${TONES[tone]}`}>{children}</span>
)

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-taupe-deep">{hint}</span>}
    </label>
  )
}

const SEC_TONES: Record<string, string> = {
  rose: 'from-pink-400 to-rose-600', violet: 'from-violet-400 to-indigo-600', sky: 'from-sky-400 to-blue-600', emerald: 'from-emerald-400 to-teal-600', amber: 'from-amber-300 to-orange-500',
}
/** Titled card section for editor pages, with a coloured icon tile. */
export function Section({ title, hint, icon: Icon, tone = 'rose', children, className = '' }: { title?: string; hint?: string; icon?: LucideIcon; tone?: keyof typeof SEC_TONES; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || hint) && (
        <header className="mb-5 flex items-center gap-3 border-b border-line/70 pb-4 sm:col-span-2">
          {Icon && <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ${SEC_TONES[tone]}`}><Icon size={19} strokeWidth={1.9} /></div>}
          <div className="min-w-0">
            {title && <h2 className="font-serif text-base font-bold leading-tight text-espresso">{title}</h2>}
            {hint && <p className="mt-0.5 text-[0.8rem] text-taupe-deep">{hint}</p>}
          </div>
        </header>
      )}
      {children}
    </section>
  )
}

/** Toggle switch row. */
export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange(v: boolean): void; label: string; hint?: string; disabled?: boolean }) {
  const flip = () => !disabled && onChange(!checked)
  return (
    <div role="switch" aria-checked={checked} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} onClick={flip} onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), flip())}
      className={`flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-3.5 py-3 transition ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-gold/60'}`}>
      <span className="min-w-0"><span className="block text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-taupe-deep">{hint}</span>}</span>
      <span className="switch" data-on={checked}><span /></span>
    </div>
  )
}

/** Pill tabs with counts (used as quick filters above tables). */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange(v: T): void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-card)]">
      {items.map((t) => {
        const on = t.value === value
        return (
          <button key={t.value} role="tab" aria-selected={on} type="button" onClick={() => onChange(t.value)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${on ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md' : 'text-taupe-deep hover:bg-gold-soft hover:text-gold-deep'}`}>
            {t.label}
            {t.count !== undefined && <span className={`rounded-full px-1.5 text-[0.7rem] font-semibold ${on ? 'bg-white/25 text-white' : 'bg-stone-100 text-taupe-deep'}`}>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Small square icon button for table row actions. */
export function IconButton({ label, onClick, to, tone = 'default', children }: { label: string; onClick?(): void; to?: string; tone?: 'default' | 'danger' | 'brand'; children: ReactNode }) {
  const cls = `grid h-8 w-8 place-items-center rounded-lg border transition ${tone === 'danger' ? 'border-red-100 text-danger hover:bg-red-50' : tone === 'brand' ? 'border-gold/30 bg-gold-soft text-gold-deep hover:bg-gold/20' : 'border-line text-taupe-deep hover:bg-ivory hover:text-ink'}`
  return to
    ? <Link to={to} title={label} aria-label={label} className={cls} onClick={(e) => e.stopPropagation()}>{children}</Link>
    : <button type="button" title={label} aria-label={label} className={cls} onClick={(e) => { e.stopPropagation(); onClick?.() }}>{children}</button>
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-espresso/50 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-400 via-rose-500 to-violet-500" />
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-line/70 pb-4">
          <h2 className="text-xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- toasts ---------- */
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => undefined)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; text: string; tone: 'ok' | 'error' }[]>([])
  const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s.slice(-3), { id, text, tone }])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" role="status" className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`flex max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-sm text-white shadow-xl ${t.tone === 'ok' ? 'bg-espresso' : 'bg-danger'}`}>
            {t.tone === 'ok' ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-300" /> : <AlertCircle size={17} className="mt-0.5 shrink-0" />}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastCtx)
