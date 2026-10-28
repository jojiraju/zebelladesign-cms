import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, isConfigured } from './firebase'
import { can, isRole, type Permission, type Role } from './permissions'

interface Ctx {
  user: User | null
  role: Role | null
  ready: boolean
  can(p: Permission): boolean
  login(email: string, password: string): Promise<void>
  google(): Promise<void>
  logout(): Promise<void>
  /** Re-reads custom claims (needed right after a role is granted). */
  refresh(): Promise<void>
}

const C = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [ready, setReady] = useState(!isConfigured)

  const load = useCallback(async (u: User | null, force = false) => {
    setUser(u)
    if (!u) setRole(null)
    else {
      const t = await u.getIdTokenResult(force)
      setRole(isRole(t.claims.role) ? t.claims.role : null)
    }
    setReady(true)
  }, [])

  useEffect(() => (isConfigured ? onAuthStateChanged(auth, (u) => { void load(u) }) : undefined), [load])

  const value = useMemo<Ctx>(() => ({
    user, role, ready,
    can: (p) => can(role, p),
    login: async (e, p) => { await signInWithEmailAndPassword(auth, e, p) },
    google: async () => { await signInWithPopup(auth, new GoogleAuthProvider()) },
    logout: () => signOut(auth),
    refresh: () => load(auth.currentUser, true),
  }), [user, role, ready, load])

  return <C.Provider value={value}>{children}</C.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const c = useContext(C)
  if (!c) throw new Error('useAuth outside provider')
  return c
}
