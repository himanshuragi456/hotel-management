import useAuthStore from '@/store/authStore'
import { logout } from '@/services/authService'
import { useNavigate } from 'react-router-dom'

export default function ChefDashboard() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Kitchen Dashboard — {user?.name}</h1>
        <button onClick={handleLogout} className="text-sm text-red-400 hover:underline">Logout</button>
      </header>
      <main className="p-6">
        <div className="text-center text-gray-400 mt-20">
          <p className="text-4xl mb-4">🍳</p>
          <p className="text-lg">Live kitchen order feed</p>
          <p className="text-sm mt-2">Coming in Phase 3 — WebSocket realtime orders</p>
        </div>
      </main>
    </div>
  )
}
