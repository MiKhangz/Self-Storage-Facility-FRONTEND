import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setUnauthorizedHandler } from '../../api/axiosClient'
import { authApi } from '../../api/generated'
import type { Role } from './roles'

export type Session = { userId: number; fullName: string; role: Role; expiresAt: string }

type AuthContextValue = {
  session: Session | null
  /** True while a reloaded page asks the API whether its session cookie is still good. */
  restoring: boolean
  login: (email: string, password: string) => Promise<Session>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// The token never reaches page scripts: the API keeps it in an HttpOnly cookie (no localStorage, as the assignment
// requires) and the browser sends it on every /api call. A reload asks /api/auth/session who is signed in; the
// session ends when the token expires (Jwt:ExpiresMinutes on the API), on logout, or on any 401.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(true)
  const queryClient = useQueryClient()

  const readSession = useCallback(async () => {
    const s = await authApi.session()
    return { userId: s.userId, fullName: s.fullName ?? '', role: s.role as Role, expiresAt: s.expiresAt } as Session
  }, [])

  // Cached API data belongs to whoever fetched it: without clearing, the next person to sign in on this browser
  // briefly sees the previous user's contracts and invoices.
  const logout = useCallback(() => {
    setSession(null)
    queryClient.clear()
    authApi.logout().catch(() => {}) // the cookie expires with the token anyway
  }, [queryClient])

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login({ email, password })
    const next = await readSession()
    queryClient.clear()
    setSession(next)
    return next
  }, [queryClient, readSession])

  useEffect(() => {
    readSession().then(setSession, () => setSession(null)).finally(() => setRestoring(false))
  }, [readSession])

  // Only a signed-in user can be signed out by a 401; a failed login or the restore check is just a 401.
  useEffect(() => {
    if (!session) return
    setUnauthorizedHandler(logout)
    // Sign out the moment the token expires rather than on the next failed request.
    const timer = setTimeout(logout, Math.max(0, Date.parse(session.expiresAt) - Date.now()))
    return () => { setUnauthorizedHandler(null); clearTimeout(timer) }
  }, [session, logout])

  const value = useMemo(() => ({ session, restoring, login, logout }), [session, restoring, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}
