import useAuthStore from '@/store/authStore'
import { logout } from '@/services/authService'
import { useNavigate } from 'react-router-dom'

export default function WaiterDashboard() {
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
        <h1 className="text-lg font-semibold text-gray-900">Waiter — {user?.name}</h1>
        <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
      </header>
      <main className="p-6">
        <div className="grid grid-cols-2 gap-4 max-w-md">
          {['Tables', 'New Order', 'My Orders'].map((item) => (
            <div key={item} className="bg-white rounded-xl border border-gray-200 p-6 text-center cursor-pointer hover:shadow-sm">
              <h3 className="font-medium text-gray-900">{item}</h3>
              <p className="text-xs text-gray-500 mt-1">Phase 3</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
