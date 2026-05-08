import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import { logout } from '@/services/authService'
import NotificationBell from '@/components/shared/NotificationBell'

const NAV = [
  { label: 'Dashboard',    path: '/owner',                     icon: '📊' },
  { label: 'Live Orders',  path: '/owner/orders',              icon: '🔴' },
  { label: 'Menu',         path: '/owner/menu',                icon: '🍽' },
  { label: 'Tables',       path: '/owner/tables',              icon: '🪑' },
  { label: 'Expenses',     path: '/owner/expenses',            icon: '💸' },
  { label: 'Reports',      path: '/owner/reports',             icon: '📈' },
  { label: 'Analytics',    path: '/owner/analytics',           icon: '📉' },
  { label: '— Hotel',      path: null, icon: null, divider: true },
  { label: 'Rooms',        path: '/owner/hotel/rooms',         icon: '🏨' },
  { label: 'Bookings',     path: '/owner/hotel/bookings',      icon: '📅' },
  { label: 'Guests',       path: '/owner/hotel/guests',        icon: '👤' },
  { label: 'Hotel Reports',path: '/owner/hotel/reports',       icon: '📊' },
  { label: '— Feedback',   path: null, icon: null, divider: true },
  { label: 'QR Setup',     path: '/owner/feedback/setup',      icon: '🔗' },
  { label: 'Reviews',      path: '/owner/feedback/dashboard',  icon: '⭐' },
  { label: '— System',     path: null, icon: null, divider: true },
  { label: 'Audit Log',    path: '/owner/audit-log',           icon: '🔍' },
]

export default function OwnerLayout() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    clearAuth(); navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className={`${open ? 'w-52' : 'w-14'} transition-all bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto`}>
        <div className="p-4 border-b border-gray-100 flex items-center gap-2 sticky top-0 bg-white z-10">
          <span className="text-xl">🍽</span>
          {open && <span className="font-semibold text-sm text-gray-800 truncate">{user?.name?.split(' ')[0]}</span>}
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map((item) => item.divider ? (
            open ? (
              <div key={item.label} className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.label}</div>
            ) : <div key={item.label} className="border-t border-gray-100 my-2" />
          ) : (
            <NavLink key={item.path} to={item.path} end={item.path === '/owner'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              <span>{item.icon}</span>
              {open && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
            <span>🚪</span>{open && 'Logout'}
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-gray-600">☰</button>
          <span className="text-sm text-gray-500 flex-1">Owner Panel</span>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-6"><Outlet /></main>
      </div>
    </div>
  )
}
