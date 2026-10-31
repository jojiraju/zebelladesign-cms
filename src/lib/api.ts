import { getStoredToken } from './auth'

const BASE = (import.meta.env.VITE_STOREFRONT_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

/** Calls a backend endpoint with the user's JWT token. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string; message?: string }).message ?? (data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

/** Refresh storefront caches after content/catalog changes (best effort). */
export const revalidateStorefront = () => api('/api/admin/revalidate', { method: 'POST', body: '{}' }).catch(() => undefined)
