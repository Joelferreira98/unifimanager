import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/Login'
import AppLayout from './components/AppLayout'
import DashboardPage from './pages/Dashboard'
import VouchersPage from './pages/Vouchers'
import PlansPage from './pages/Plans'
import CompaniesPage from './pages/Companies'
import UsersPage from './pages/Users'
import CashRegisterPage from './pages/CashRegister'
import ReportsPage from './pages/Reports'
import GlobalReportsPage from './pages/GlobalReports'
import ProfilePage from './pages/Profile'
import SettingsPage from './pages/Settings'
import VoucherTemplatePage from './pages/VoucherTemplate'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="vouchers" element={<VouchersPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="cash-register" element={<CashRegisterPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="global-reports" element={<GlobalReportsPage />} />
          <Route path="voucher-template" element={<VoucherTemplatePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
