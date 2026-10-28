import { auth } from './firebase'

const BASE = (import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:3000').replace(/\/$/, '')

/** Calls a privileged storefront endpoint with the signed-in user's Firebase ID token. The server re-checks the role. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

/** Refresh storefront caches after content/catalog changes (best effort). */
export const revalidateStorefront = () => api('/api/admin/revalidate', { method: 'POST', body: '{}' }).catch(() => undefined)
