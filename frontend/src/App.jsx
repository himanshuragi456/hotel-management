import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RequireAuth, RedirectIfAuth } from '@/components/layouts/RoleGuard'
import { ToastProvider } from '@/components/shared/Toast'
import GlobalErrorModal from '@/components/shared/GlobalErrorModal'
import useAuthStore from '@/store/authStore'

function OwnerIndexRedirect() {
  const modules = useAuthStore(s => s.user?.modules)
  if (modules && modules.feedback && !modules.restaurant && !modules.hotel) {
    return <Navigate to="/owner/feedback/dashboard" replace />
  }
  return <Navigate to="/owner/dashboard" replace />
}

import Login from '@/pages/auth/Login'
import LandingPage from '@/pages/LandingPage'
import FeedbackLandingPage from '@/pages/FeedbackLandingPage'

// Superadmin
import SuperadminLayout from '@/components/layouts/SuperadminLayout'
import Overview from '@/pages/superadmin/Overview'
import TenantList from '@/pages/superadmin/tenants/TenantList'
import TenantDetail from '@/pages/superadmin/tenants/TenantDetail'
import PlanList from '@/pages/superadmin/plans/PlanList'
import AuditLogs from '@/pages/superadmin/audit/AuditLogs'
import BrandingSettings from '@/pages/superadmin/BrandingSettings'

// Owner
import OwnerLayout from '@/components/layouts/OwnerLayout'
import OwnerDashboard from '@/pages/owner/Dashboard'
import MenuManager from '@/pages/owner/menu/MenuManager'
import TableManager from '@/pages/owner/tables/TableManager'
import LiveOrders from '@/pages/owner/orders/LiveOrders'
import Expenses from '@/pages/owner/expenses/Expenses'
import Reports from '@/pages/owner/reports/Reports'
import RoomManager from '@/pages/owner/hotel/RoomManager'
import Bookings from '@/pages/owner/hotel/Bookings'
import Guests from '@/pages/owner/hotel/Guests'
import HotelReports from '@/pages/owner/hotel/HotelReports'
import FeedbackSetup from '@/pages/owner/feedback/FeedbackSetup'
import FeedbackDashboard from '@/pages/owner/feedback/FeedbackDashboard'
import Analytics from '@/pages/owner/analytics/Analytics'
import OwnerAuditLog from '@/pages/owner/analytics/AuditLog'
import StaffManager from '@/pages/owner/staff/StaffManager'
import OwnerSettings from '@/pages/owner/settings/Settings'
import FeedbackPage from '@/pages/feedback/FeedbackPage'

// Waiter
import WaiterDashboard from '@/pages/waiter/Dashboard'

// Chef
import ChefDashboard from '@/pages/chef/Dashboard'

// Billing (used by both billing role and owner)
import BillingDashboard from '@/pages/billing/Dashboard'

// Customer (public — no auth)
import CustomerMenuPage from '@/pages/customer/MenuPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <GlobalErrorModal />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<><RedirectIfAuth /><Login /></>} />

          {/* Customer QR menu — no auth required */}
          <Route path="/menu/:slug/:token" element={<CustomerMenuPage />} />

          {/* Feedback — public, no auth */}
          <Route path="/feedback/:token" element={<FeedbackPage />} />

          {/* Superadmin */}
          <Route path="/superadmin" element={<RequireAuth roles={['superadmin']}><SuperadminLayout /></RequireAuth>}>
            <Route index element={<Overview />} />
            <Route path="tenants" element={<TenantList />} />
            <Route path="tenants/:id" element={<TenantDetail />} />
            <Route path="plans" element={<PlanList />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="branding" element={<BrandingSettings />} />
          </Route>

          {/* Owner */}
          <Route path="/owner" element={<RequireAuth roles={['owner']}><OwnerLayout /></RequireAuth>}>
            <Route index element={<OwnerIndexRedirect />} />
            <Route path="dashboard" element={<OwnerDashboard />} />
            <Route path="menu" element={<MenuManager />} />
            <Route path="tables" element={<TableManager />} />
            <Route path="orders" element={<LiveOrders />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="reports" element={<Reports />} />
            {/* Hotel module */}
            <Route path="hotel/rooms" element={<RoomManager />} />
            <Route path="hotel/bookings" element={<Bookings />} />
            <Route path="hotel/guests" element={<Guests />} />
            <Route path="hotel/reports" element={<HotelReports />} />
            {/* Feedback module */}
            <Route path="feedback/setup" element={<FeedbackSetup />} />
            <Route path="feedback/dashboard" element={<FeedbackDashboard />} />
            {/* Analytics */}
            <Route path="analytics" element={<Analytics />} />
            <Route path="audit-log" element={<OwnerAuditLog />} />
            {/* Staff */}
            <Route path="staff" element={<StaffManager />} />
            {/* Settings */}
            <Route path="settings" element={<OwnerSettings />} />
            {/* Billing counter — owner has full billing powers */}
            <Route path="billing" element={<BillingDashboard embedded />} />
          </Route>

          {/* Waiter */}
          <Route path="/waiter" element={<RequireAuth roles={['waiter']}><WaiterDashboard /></RequireAuth>} />

          {/* Chef */}
          <Route path="/chef" element={<RequireAuth roles={['chef']}><ChefDashboard /></RequireAuth>} />

          {/* Billing */}
          <Route path="/billing" element={<RequireAuth roles={['billing']}><BillingDashboard /></RequireAuth>} />

          {/* Landing pages */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/feedback-landing" element={<FeedbackLandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
