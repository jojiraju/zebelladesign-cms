import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { can, isRole, type Permission, type Role } from './permissions'

export interface AuthUser {
  id: string
  uid?: string
  email: string
  name?: string
  displayName?: string | null
  role?: Role
}

interface Ctx {
  user: AuthUser | null
  role: Role | null
  ready: boolean
  token: string | null
  can(p: Permission): boolean
  login(email: string, password: string): Promise<void>
  devLogin(): void
  logout(): Promise<void>
  refresh(): Promise<void>
}

const C = createContext<Ctx | null>(null)

const TOKEN_KEY = 'zebella_auth_token'
const USER_KEY = 'zebella_auth_user'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [role, setRole] = useState<Role | null>(() => {
    const u = getStoredUser()
    return u && isRole(u.role) ? u.role : (u ? 'admin' : null)
  })
  const [ready, setReady] = useState(false)

  // Verify stored session on startup
  useEffect(() => {
    const storedUser = getStoredUser()
    const storedToken = getStoredToken()
    if (storedToken && storedUser) {
      setUser(storedUser)
      setRole(isRole(storedUser.role) ? storedUser.role : 'admin')
      setToken(storedToken)
    }
    setReady(true)
  }, [])

  const persistAuth = useCallback((u: AuthUser | null, t: string | null) => {
    if (u && t) {
      localStorage.setItem(TOKEN_KEY, t)
      localStorage.setItem(USER_KEY, JSON.stringify(u))
      setUser(u)
      setToken(t)
      setRole(isRole(u.role) ? u.role : 'admin')
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setUser(null)
      setToken(null)
      setRole(null)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const baseUrl = (import.meta.env.VITE_STOREFRONT_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
    try {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        const data = await res.json()
        const userObj: AuthUser = {
          id: data.user?.id || data.user?.uid || '1',
          email: data.user?.email || email,
          name: data.user?.name,
          role: isRole(data.user?.role) ? data.user.role : 'admin',
        }
        const jwtToken = data.token || data.accessToken || 'demo_token'
        persistAuth(userObj, jwtToken)
        return
      }

      const errData = await res.json().catch(() => ({}))
      throw new Error((errData as { message?: string; error?: string }).message || (errData as { error?: string }).error || `Login failed (${res.status})`)
    } catch (e) {
      // If backend server is unreachable during development, allow logging in in local dev mode
      const errMsgStr = e instanceof Error ? e.message : String(e)
      if (errMsgStr.includes('Failed to fetch') || errMsgStr.includes('NetworkError') || errMsgStr.includes('ECONNREFUSED')) {
        console.warn('Backend server is not running at ' + baseUrl + '. Logging in in local development mode.')
        const devUser: AuthUser = {
          id: 'dev_user_1',
          email,
          role: 'admin',
        }
        persistAuth(devUser, 'dev_jwt_token_' + Date.now())
        return
      }
      throw e
    }
  }, [persistAuth])

  const devLogin = useCallback(() => {
    const devUser: AuthUser = {
      id: 'dev_admin',
      email: 'admin@zebelladesigns.com',
      name: 'Studio Admin',
      role: 'admin',
    }
    persistAuth(devUser, 'dev_jwt_token_local')
  }, [persistAuth])

  const logout = useCallback(async () => {
    const baseUrl = (import.meta.env.VITE_STOREFRONT_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
    const currentToken = getStoredToken()
    if (currentToken) {
      try {
        await fetch(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          },
        })
      } catch {
        // Best effort
      }
    }
    persistAuth(null, null)
  }, [persistAuth])

  const refresh = useCallback(async () => {
    const u = getStoredUser()
    const t = getStoredToken()
    if (u && t) {
      persistAuth(u, t)
    }
  }, [persistAuth])

  const value = useMemo<Ctx>(() => ({
    user,
    role,
    ready,
    token,
    can: (p) => can(role, p),
    login,
    devLogin,
    logout,
    refresh,
  }), [user, role, ready, token, login, devLogin, logout, refresh])

  return <C.Provider value={value}>{children}</C.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const c = useContext(C)
  if (!c) throw new Error('useAuth outside provider')
  return c
}
