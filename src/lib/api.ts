import { SESSION_EXPIRED, clearSession, getStoredRefresh, getStoredToken, storeTokens } from './session'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

async function renewToken(expired: string): Promise<string | null> {
  // Another request or browser tab may have renewed it while this one waited.
  const current = getStoredToken()
  if (current && current !== expired) return current
  const refresh = getStoredRefresh()
  if (!refresh) return null
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { token: string; refresh: string }
  storeTokens(data.token, data.refresh)
  return data.token
}

let renewal: Promise<string | null> | null = null

/**
 * Refresh tokens are single use, so parallel 401s must share one renewal: if each started its own,
 * the second would present a token the first had already used, and the user would be signed out.
 * The browser lock extends that guarantee across tabs.
 */
function renewOnce(expired: string): Promise<string | null> {
  renewal ??= (navigator.locks
    ? navigator.locks.request('zebella-token-refresh', () => renewToken(expired))
    : renewToken(expired)
  ).finally(() => { renewal = null })
  return renewal
}

function send(path: string, init: RequestInit, token: string | null) {
  const isForm = init.body instanceof FormData
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

/** Calls the backend with the signed-in user's token, renewing it once if it has expired. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  let res = await send(path, init, token)
  if (res.status === 401 && token) {
    const renewed = await renewOnce(token)
    if (!renewed) {
      clearSession()
      window.dispatchEvent(new Event(SESSION_EXPIRED))
      throw new Error('Your session has expired. Please sign in again.')
    }
    res = await send(path, init, renewed)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `Request failed (${res.status})`)
  return data as T
}

export interface ListResult<T> { count: number; results: T[] }

/** Reads a list endpoint. Empty parameters are left out. */
export function apiList<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value))
  const qs = query.toString()
  return api<ListResult<T>>(qs ? `${path}?${qs}` : path)
}
