import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Squares2X2Icon,
  ClipboardDocumentListIcon,
  Bars3BottomLeftIcon,
  TableCellsIcon,
  ChartBarIcon,
  PresentationChartLineIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  UsersIcon,
  DocumentChartBarIcon,
  QrCodeIcon,
  StarIcon,
  BanknotesIcon,
  UserGroupIcon,
  ClipboardDocumentIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  Bars3Icon,
  BellIcon,
  XMarkIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline'
import useAuthStore from '@/store/authStore'
import { logout } from '@/services/authService'
import NotificationBell from '@/components/shared/NotificationBell'
import SubscriptionAlert from '@/components/shared/SubscriptionAlert'

const isFeedbackOnly = (modules) =>
  modules && modules.feedback && !modules.restaurant && !modules.hotel

const buildNav = (modules) => {
  if (isFeedbackOnly(modules)) {
    return [
      { label: 'QR Setup', path: '/owner/feedback/setup',     Icon: QrCodeIcon },
      { label: 'Reviews',  path: '/owner/feedback/dashboard', Icon: StarIcon },
    ]
  }

  const has = (mod) => !modules || modules[mod]
  const items = [
    { label: 'Dashboard', path: '/owner/dashboard', Icon: Squares2X2Icon },
  ]

  if (has('restaurant')) {
    items.push(
      { label: 'Restaurant', divider: true },
      { label: 'Live Orders',     path: '/owner/orders',   Icon: ClipboardDocumentListIcon },
      { label: 'Billing Counter', path: '/owner/billing',  Icon: CreditCardIcon },
      { label: 'Menu',            path: '/owner/menu',     Icon: Bars3BottomLeftIcon },
      { label: 'Tables',          path: '/owner/tables',   Icon: TableCellsIcon },
      { label: 'Reports',         path: '/owner/reports',  Icon: DocumentChartBarIcon },
      { label: 'Analytics',       path: '/owner/analytics', Icon: PresentationChartLineIcon },
    )
  }

  if (has('hotel')) {
    items.push(
      { label: 'Hotel', divider: true },
      { label: 'Rooms',         path: '/owner/hotel/rooms',    Icon: BuildingOfficeIcon },
      { label: 'Bookings',      path: '/owner/hotel/bookings', Icon: CalendarDaysIcon },
      { label: 'Guests',        path: '/owner/hotel/guests',   Icon: UsersIcon },
      { label: 'Hotel Reports', path: '/owner/hotel/reports',  Icon: ChartBarIcon },
    )
  }

  if (has('feedback')) {
    items.push(
      { label: 'Feedback', divider: true },
      { label: 'QR Setup', path: '/owner/feedback/setup',     Icon: QrCodeIcon },
      { label: 'Reviews',  path: '/owner/feedback/dashboard', Icon: StarIcon },
    )
  }

  items.push(
    { label: 'System', divider: true },
    { label: 'Expenses',  path: '/owner/expenses',  Icon: BanknotesIcon },
    { label: 'Staff',     path: '/owner/staff',     Icon: UserGroupIcon },
    { label: 'Audit Log', path: '/owner/audit-log', Icon: ClipboardDocumentIcon },
  )

  return items
}

function SidebarContent({ NAV, collapsed, user, handleLogout, setCollapsed, closeMobile }) {
  return (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-gray-100 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center flex-shrink-0">
          <BuildingOfficeIcon className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm text-gray-800 truncate flex-1">{user?.name?.split(' ')[0]}</span>
        )}
        {/* Close button — mobile only */}
        {closeMobile && (
          <button onClick={closeMobile} className="ml-auto p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => item.divider ? (
          collapsed
            ? <div key={item.label} className="border-t border-gray-100 my-2 mx-1" />
            : <p key={item.label} className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.label}</p>
        ) : (
          <NavLink key={item.path} to={item.path}
            onClick={closeMobile}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-orange-50 text-orange-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }`
            }>
            <item.Icon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-gray-100 space-y-1 flex-shrink-0">
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-gray-700 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        )}
        <button onClick={handleLogout} title="Sign out"
          className="w-full flex items-center gap-3 px-2.5 py-2 text-sm text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
          <ArrowRightOnRectangleIcon className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && 'Sign out'}
        </button>
        {/* Collapse toggle — desktop only */}
        {!closeMobile && (
          <button onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center gap-3 px-2.5 py-2 text-sm text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            {collapsed
              ? <Bars3Icon className="w-[18px] h-[18px]" />
              : <><ChevronLeftIcon className="w-[18px] h-[18px]" /><span>Collapse</span></>
            }
          </button>
        )}
      </div>
    </>
  )
}

export default function OwnerLayout() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const modules = user?.modules
  const NAV = buildNav(modules)

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent
          NAV={NAV} collapsed={false} user={user}
          handleLogout={handleLogout} setCollapsed={setCollapsed}
          closeMobile={() => setMobileOpen(false)}
        />
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex ${collapsed ? 'w-[60px]' : 'w-56'} transition-all duration-200 bg-white border-r border-gray-200 flex-col shrink-0`}>
        <SidebarContent
          NAV={NAV} collapsed={collapsed} user={user}
          handleLogout={handleLogout} setCollapsed={setCollapsed}
          closeMobile={null}
        />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center gap-3 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <Bars3Icon className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-400 flex-1 truncate">Owner Panel</span>
          <NotificationBell />
        </header>
        <SubscriptionAlert />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
