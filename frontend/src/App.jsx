import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RequireAuth, RedirectIfAuth } from '@/components/layouts/RoleGuard'

import Login from '@/pages/auth/Login'
import SuperadminDashboard from '@/pages/superadmin/Dashboard'
import OwnerDashboard from '@/pages/owner/Dashboard'
import WaiterDashboard from '@/pages/waiter/Dashboard'
import ChefDashboard from '@/pages/chef/Dashboard'
import BillingDashboard from '@/pages/billing/Dashboard'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route
            path="/login"
            element={
              <>
                <RedirectIfAuth />
                <Login />
              </>
            }
          />

          {/* Superadmin */}
          <Route
            path="/superadmin/*"
            element={
              <RequireAuth roles={['superadmin']}>
                <SuperadminDashboard />
              </RequireAuth>
            }
          />

          {/* Owner */}
          <Route
            path="/owner/*"
            element={
              <RequireAuth roles={['owner']}>
                <OwnerDashboard />
              </RequireAuth>
            }
          />

          {/* Waiter */}
          <Route
            path="/waiter/*"
            element={
              <RequireAuth roles={['waiter']}>
                <WaiterDashboard />
              </RequireAuth>
            }
          />

          {/* Chef */}
          <Route
            path="/chef/*"
            element={
              <RequireAuth roles={['chef']}>
                <ChefDashboard />
              </RequireAuth>
            }
          />

          {/* Billing */}
          <Route
            path="/billing/*"
            element={
              <RequireAuth roles={['billing']}>
                <BillingDashboard />
              </RequireAuth>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
