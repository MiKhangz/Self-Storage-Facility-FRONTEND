import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setAccessToken, setUnauthorizedHandler } from '../../api/axiosClient'
import { authApi } from '../../api/generated'
import type { Role } from './roles'

export type Session = { token: string; userId: number; fullName: string; role: Role }

type AuthContextValue = {
  session: Session | null
  login: (email: string, password: string) => Promise<Session>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// The token is kept in React state only. A page reload signs the user out; that is the price of never
// putting it in localStorage, which the assignment forbids.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const queryClient = useQueryClient()

  // Cached API data belongs to whoever fetched it: without clearing, the next person to sign in on this browser
  // briefly sees the previous user's contracts and invoices.
  const logout = useCallback(() => {
    setAccessToken(null)
    setSession(null)
    queryClient.clear()
  }, [queryClient])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    // The generated types mark every field optional (Swashbuckle omits `required`); a 200 always carries these.
    if (!response.token || response.userId == null || !response.role)
      throw new Error('Login response is missing token, userId or role.')
    const next: Session = {
      token: response.token,
      userId: response.userId,
      fullName: response.fullName ?? '',
      role: response.role as Role,
    }
    // Set before the state update so requests fired by the next render already carry the token.
    queryClient.clear()
    setAccessToken(next.token)
    setSession(next)
    return next
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}
