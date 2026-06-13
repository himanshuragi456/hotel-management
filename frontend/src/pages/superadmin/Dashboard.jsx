import useAuthStore from '@/store/authStore'
import { logout } from '@/services/authService'
import { useNavigate } from 'react-router-dom'

export default function SuperadminDashboard() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Superadmin Panel</h1>
          <p className="text-xs text-gray-500">Hotel Management SaaS</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
        </div>
      </header>
      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Tenants', 'Subscription Plans', 'Payments', 'Audit Logs', 'Module Config', 'Users'].map((item) => (
            <div key={item} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow cursor-pointer">
              <h3 className="font-medium text-gray-900">{item}</h3>
              <p className="text-sm text-gray-500 mt-1">Coming in Phase 2</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
