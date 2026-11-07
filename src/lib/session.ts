import type { Role } from './permissions'

export interface AuthUser {
  id: string
  uid?: string
  email: string
  name?: string
  displayName?: string | null
  role?: Role | null
}

const TOKEN_KEY = 'zebella_auth_token'
const REFRESH_KEY = 'zebella_auth_refresh'
const USER_KEY = 'zebella_auth_user'

/** Fired when the session can't be renewed, so the app returns to the login page. */
export const SESSION_EXPIRED = 'zebella:session-expired'

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY)
export const getStoredRefresh = () => localStorage.getItem(REFRESH_KEY)

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeTokens(token: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function storeUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}
