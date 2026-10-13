import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { RequireAuth } from './features/auth/RequireAuth'
import { ADMIN_PORTAL_ROLES, Roles } from './features/auth/roles'
import LoginAdmin from './admin/loginPage/adminPage/LoginAdmin.jsx'
import DashboardLayout from './admin/dashboard/DashboardLayout.jsx'
import CustomerLayout from './customer/layout/CustomerLayout.jsx'
import HomePage from './customer/home/HomePage.jsx'
import LoginPage from './customer/auth/LoginPage.jsx'
import RegisterPage from './customer/auth/RegisterPage.jsx'
import ForgotPasswordPage from './customer/auth/ForgotPasswordPage.jsx'
import SizesPage from './customer/sizes/SizesPage.jsx'
import LocationsPage from './customer/locations/LocationsPage.jsx'
import ChooseUnitPage from './customer/booking/ChooseUnitPage.jsx'
import BookingDetailsPage from './customer/booking/BookingDetailsPage.jsx'
import BookingConfirmedPage from './customer/booking/BookingConfirmedPage.jsx'
import AccountLayout from './customer/account/AccountLayout.jsx'
import MyStoragePage from './customer/account/MyStoragePage.jsx'
import UnitDetailPage from './customer/account/UnitDetailPage.jsx'
import PaymentsPage from './customer/account/PaymentsPage.jsx'
import SupportRequestPage from './customer/support/SupportRequestPage.jsx'
import TicketDetailPage from './customer/support/TicketDetailPage.jsx'

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

/** Customer pages that need a signed-in Storage Customer; anyone else is sent to /login and brought back. */
function CustomerOnly() {
  return (
    <RequireAuth roles={[Roles.StorageCustomer]} loginPath="/login">
      <Outlet />
    </RequireAuth>
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
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/sizes" element={<SizesPage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/booking" element={<ChooseUnitPage />} />
              <Route element={<CustomerOnly />}>
                <Route path="/booking/details" element={<BookingDetailsPage />} />
                <Route path="/booking/confirmed/:id" element={<BookingConfirmedPage />} />
                <Route element={<AccountLayout />}>
                  <Route path="/my-storage" element={<MyStoragePage />} />
                  <Route path="/my-storage/units/:contractId" element={<UnitDetailPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/support/new" element={<SupportRequestPage />} />
                  <Route path="/support/requests" element={<SupportRequestPage />} />
                  <Route path="/support/requests/:ticketId" element={<TicketDetailPage />} />
                </Route>
              </Route>
            </Route>
            {/* Customer screens not built yet land on the home page. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
