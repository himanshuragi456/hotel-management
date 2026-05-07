import useAuthStore from '@/store/authStore'
import { logout } from '@/services/authService'
import { useNavigate } from 'react-router-dom'

export default function OwnerDashboard() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Owner Dashboard</h1>
          <p className="text-xs text-gray-500">Restaurant & Hotel Management</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
        </div>
      </header>
      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Orders', 'Menu', 'Tables', 'Rooms', 'Bookings', 'Reports', 'Staff', 'Feedback', 'Analytics'].map((item) => (
            <div key={item} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow cursor-pointer">
              <h3 className="font-medium text-gray-900">{item}</h3>
              <p className="text-sm text-gray-500 mt-1">Coming in Phase 3+</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
