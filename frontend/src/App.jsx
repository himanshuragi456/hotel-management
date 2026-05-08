import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RequireAuth, RedirectIfAuth } from '@/components/layouts/RoleGuard'

import Login from '@/pages/auth/Login'

// Superadmin
import SuperadminLayout from '@/components/layouts/SuperadminLayout'
import Overview from '@/pages/superadmin/Overview'
import TenantList from '@/pages/superadmin/tenants/TenantList'
import TenantDetail from '@/pages/superadmin/tenants/TenantDetail'
import PlanList from '@/pages/superadmin/plans/PlanList'
import SubscriptionList from '@/pages/superadmin/subscriptions/SubscriptionList'
import AuditLogs from '@/pages/superadmin/audit/AuditLogs'

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
import FeedbackPage from '@/pages/feedback/FeedbackPage'

// Waiter
import WaiterDashboard from '@/pages/waiter/Dashboard'

// Chef
import ChefDashboard from '@/pages/chef/Dashboard'

// Billing
import BillingDashboard from '@/pages/billing/Dashboard'

// Customer (public — no auth)
import CustomerMenuPage from '@/pages/customer/MenuPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
            <Route path="subscriptions" element={<SubscriptionList />} />
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>

          {/* Owner */}
          <Route path="/owner" element={<RequireAuth roles={['owner']}><OwnerLayout /></RequireAuth>}>
            <Route index element={<OwnerDashboard />} />
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
          </Route>

          {/* Waiter */}
          <Route path="/waiter" element={<RequireAuth roles={['waiter']}><WaiterDashboard /></RequireAuth>} />

          {/* Chef */}
          <Route path="/chef" element={<RequireAuth roles={['chef']}><ChefDashboard /></RequireAuth>} />

          {/* Billing */}
          <Route path="/billing" element={<RequireAuth roles={['billing']}><BillingDashboard /></RequireAuth>} />

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
