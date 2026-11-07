export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const formatINR = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format((paise || 0) / 100)

export const toPaise = (rupees: string | number) => Math.round(Number(rupees || 0) * 100)
export const toRupees = (paise?: number | null) => (paise == null ? '' : String(paise / 100))

export const fmtDate = (ms?: number | null) =>
  ms ? new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')
