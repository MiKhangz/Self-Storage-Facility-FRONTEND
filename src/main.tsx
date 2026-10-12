import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './features/auth/AuthContext'
import { RequireAuth } from './features/auth/RequireAuth'
import { ADMIN_PORTAL_ROLES } from './features/auth/roles'
import LoginAdmin from './admin/loginPage/adminPage/LoginAdmin.jsx'
import FacilityPage from './admin/facilitiesPage/FacilityPage.jsx'

const queryClient = new QueryClient({
  // 4xx answers are final (validation, permission, not found); retrying them only delays the message.
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/admin/login" element={<LoginAdmin />} />
            <Route
              path="/admin/facilities"
              element={
                <RequireAuth roles={ADMIN_PORTAL_ROLES} loginPath="/admin/login">
                  <FacilityPage />
                </RequireAuth>
              }
            />
            {/* Customer screens are not built yet, so everything else lands on the admin sign-in. */}
            <Route path="*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
