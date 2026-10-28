export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const formatINR = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format((paise || 0) / 100)

export const toPaise = (rupees: string | number) => Math.round(Number(rupees || 0) * 100)
export const toRupees = (paise?: number | null) => (paise == null ? '' : String(paise / 100))

export const fmtDate = (ms?: number | null) =>
  ms ? new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

/** Firestore Timestamp | number | undefined -> epoch millis */
export const millis = (v: unknown): number | undefined => {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'toMillis' in v) return (v as { toMillis(): number }).toMillis()
  return undefined
}

/** Drops `undefined` values (Firestore rejects them) via a JSON round-trip. Only use on plain data. */
export const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export const errMsg =(e: unknown) => {
  const code = (e as { code?: string })?.code
  if (code === 'permission-denied') return 'You do not have permission to do that.'
  if (code?.startsWith('storage/unauthorized')) return 'Upload was blocked: check your role, file type and size.'
  return e instanceof Error ? e.message : 'Something went wrong.'
}
