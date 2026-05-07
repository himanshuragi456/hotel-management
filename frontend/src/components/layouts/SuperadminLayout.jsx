import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import { logout } from '@/services/authService'

const NAV = [
  { label: 'Overview',      path: '/superadmin',                  icon: '📊' },
  { label: 'Tenants',       path: '/superadmin/tenants',          icon: '🏢' },
  { label: 'Plans',         path: '/superadmin/plans',            icon: '📋' },
  { label: 'Subscriptions', path: '/superadmin/subscriptions',    icon: '💳' },
  { label: 'Audit Logs',    path: '/superadmin/audit-logs',       icon: '📜' },
]

export default function SuperadminLayout() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-14'} transition-all bg-gray-900 text-white flex flex-col shrink-0`}>
        <div className="p-4 border-b border-gray-700 flex items-center gap-2">
          <span className="text-lg">🏨</span>
          {sidebarOpen && <span className="font-semibold text-sm truncate">Hotel SaaS Admin</span>}
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/superadmin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              <span>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-700">
          {sidebarOpen && (
            <div className="mb-2 text-xs text-gray-400 truncate">{user?.name}</div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-lg"
          >
            <span>🚪</span>
            {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-gray-700"
          >
            ☰
          </button>
          <h1 className="text-sm font-medium text-gray-600">Superadmin Panel</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
