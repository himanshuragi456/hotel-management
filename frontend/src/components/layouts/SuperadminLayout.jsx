import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ChartBarIcon,
  BuildingOffice2Icon,
  RectangleGroupIcon,
  CreditCardIcon,
  ClipboardDocumentListIcon,
  SwatchIcon,
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline'
import useAuthStore from '@/store/authStore'
import { logout } from '@/services/authService'

const NAV = [
  { label: 'Overview',      path: '/superadmin',               Icon: ChartBarIcon },
  { label: 'Tenants',       path: '/superadmin/tenants',       Icon: BuildingOffice2Icon },
  { label: 'Plans',         path: '/superadmin/plans',         Icon: RectangleGroupIcon },
  { label: 'Subscriptions', path: '/superadmin/subscriptions', Icon: CreditCardIcon },
  { label: 'Audit Logs',    path: '/superadmin/audit-logs',    Icon: ClipboardDocumentListIcon },
  { label: 'Branding',      path: '/superadmin/branding',      Icon: SwatchIcon },
]

export default function SuperadminLayout() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-[60px]' : 'w-56'} transition-all duration-200 bg-gray-950 text-white flex flex-col shrink-0`}>
        {/* Logo area */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <BuildingOffice2Icon className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-white truncate tracking-tight">Hotel SaaS</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ label, path, Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/superadmin'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:bg-white/[0.06] hover:text-gray-200'
                }`
              }
            >
              <Icon className="w-4.5 h-4.5 w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-white/[0.06] space-y-1">
          {!collapsed && (
            <div className="px-3 py-2">
              <p className="text-xs text-gray-400 truncate">{user?.name}</p>
              <p className="text-xs text-gray-600 truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-full flex items-center gap-3 px-2.5 py-2 text-sm text-gray-400 hover:bg-white/[0.06] hover:text-red-400 rounded-lg transition-colors">
            <ArrowRightOnRectangleIcon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center gap-3 px-2.5 py-2 text-sm text-gray-600 hover:bg-white/[0.06] hover:text-gray-300 rounded-lg transition-colors">
            {collapsed
              ? <Bars3Icon className="w-[18px] h-[18px]" />
              : <><ChevronLeftIcon className="w-[18px] h-[18px]" /><span>Collapse</span></>
            }
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center gap-4 flex-shrink-0">
          <h1 className="text-sm font-medium text-gray-500">Superadmin Panel</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
