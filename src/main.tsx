import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { RequireAuth } from './features/auth/RequireAuth'
import { ADMIN_PORTAL_ROLES } from './features/auth/roles'
import LoginAdmin from './admin/loginPage/adminPage/LoginAdmin.jsx'
import DashboardLayout from './admin/dashboard/DashboardLayout.jsx'
import CustomerLayout from './customer/layout/CustomerLayout.jsx'
import HomePage from './customer/home/HomePage.jsx'

const queryClient = new QueryClient({
  // 4xx answers are final (validation, permission, not found); retrying them only delays the message.
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

/** Thiện's dashboard switches pages itself; this only gives its Log out button a real session to end. */
function AdminPortal() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return (
    <DashboardLayout
      onLogOut={() => {
        logout()
        navigate('/admin/login', { replace: true })
      }}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/admin/login" element={<LoginAdmin />} />
            <Route
              path="/admin"
              element={
                <RequireAuth roles={ADMIN_PORTAL_ROLES} loginPath="/admin/login">
                  <AdminPortal />
                </RequireAuth>
              }
            />
            <Route element={<CustomerLayout />}>
              <Route path="/" element={<HomePage />} />
            </Route>
            {/* Customer screens not built yet land on the home page. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
