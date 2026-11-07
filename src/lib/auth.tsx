import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { API_BASE, api } from './api'
import { can, isRole, type Permission, type Role } from './permissions'
import { SESSION_EXPIRED, clearSession, getStoredRefresh, getStoredToken, getStoredUser, storeTokens, storeUser, type AuthUser } from './session'

export type { AuthUser }

interface Ctx {
  user: AuthUser | null
  role: Role | null
  ready: boolean
  can(p: Permission): boolean
  login(email: string, password: string): Promise<void>
  logout(): Promise<void>
}

const C = createContext<Ctx | null>(null)

const roleOf = (u: AuthUser | null): Role | null => (u && isRole(u.role) ? u.role : null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [ready, setReady] = useState(false)

  // Stored values can't be trusted on their own, so the server confirms the session and its role.
  useEffect(() => {
    if (!getStoredToken()) {
      clearSession()
      setUser(null)
      setReady(true)
      return
    }
    api<AuthUser>('/api/auth/me')
      .then((u) => { storeUser(u); setUser(u) })
      .catch(() => { if (!getStoredToken()) setUser(null) }) // Offline: keep the session and let pages show the error.
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    const expire = () => setUser(null)
    window.addEventListener(SESSION_EXPIRED, expire)
    return () => window.removeEventListener(SESSION_EXPIRED, expire)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      throw new Error('Could not reach the server. Please try again.')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { message?: string }).message ?? `Login failed (${res.status})`)
    storeTokens(data.token, data.refresh)
    storeUser(data.user)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    const refresh = getStoredRefresh()
    clearSession()
    setUser(null)
    if (refresh) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      }).catch(() => undefined) // Best effort: this browser is signed out either way.
    }
  }, [])

  const value = useMemo<Ctx>(() => {
    const role = roleOf(user)
    return { user, role, ready, can: (p) => can(role, p), login, logout }
  }, [user, ready, login, logout])

  return <C.Provider value={value}>{children}</C.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const c = useContext(C)
  if (!c) throw new Error('useAuth outside provider')
  return c
}
