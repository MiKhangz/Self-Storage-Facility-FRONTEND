import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { Role } from './roles'

/** Wraps a route: no session goes to the login page, a session with the wrong role sees a refusal. */
export function RequireAuth({ roles, loginPath, children }: { roles: Role[]; loginPath: string; children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()

  if (!session) return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />
  if (!roles.includes(session.role)) return <p style={{ padding: 24 }}>Bạn không có quyền truy cập trang này.</p>
  return <>{children}</>
}
