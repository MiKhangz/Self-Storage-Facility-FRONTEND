import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './features/auth/AuthContext'
import { RequireAuth } from './features/auth/RequireAuth'
import { ADMIN_PORTAL_ROLES, Roles } from './features/auth/roles'
import CustomerLayout from './user/layout/CustomerLayout.jsx'
import HomePage from './user/home/HomePage.jsx'
import LoginPage from './user/auth/LoginPage.jsx'
import RegisterPage from './user/auth/RegisterPage.jsx'
import ForgotPasswordPage from './user/auth/ForgotPasswordPage.jsx'
import VerifyEmailPage from './user/auth/VerifyEmailPage.jsx'
import SizesPage from './user/sizes/SizesPage.jsx'
import LocationsPage from './user/locations/LocationsPage.jsx'
import ChooseUnitPage from './user/booking/ChooseUnitPage.jsx'
import BookingDetailsPage from './user/booking/BookingDetailsPage.jsx'
import BookingConfirmedPage from './user/booking/BookingConfirmedPage.jsx'
import AccountLayout from './user/account/AccountLayout.jsx'
import MyStoragePage from './user/account/MyStoragePage.jsx'
import UnitDetailPage from './user/account/UnitDetailPage.jsx'
import PaymentsPage from './user/account/PaymentsPage.jsx'
import SupportRequestPage from './user/support/SupportRequestPage.jsx'
import TicketDetailPage from './user/support/TicketDetailPage.jsx'
import HandoverPage from './user/account/HandoverPage.jsx'
import ProfilePage from './user/account/ProfilePage.jsx'
import LoginAdmin from './admin/loginPage/adminPage/LoginAdmin.jsx'
import AdminPortal from './admin/AdminPortal.jsx'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

function CustomerOnly() {
  return (
    <RequireAuth roles={[Roles.StorageCustomer]} loginPath="/login">
      <Outlet />
    </RequireAuth>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/admin/login" element={<LoginAdmin />} />
            <Route path="/admin" element={<AdminPortal />} />
            <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
            <Route element={<CustomerLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ForgotPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
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
                  <Route path="/handover" element={<HandoverPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
