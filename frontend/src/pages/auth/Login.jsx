import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EnvelopeIcon, LockClosedIcon, BuildingOffice2Icon, SparklesIcon } from '@heroicons/react/24/outline'
import useAuthStore from '@/store/authStore'
import { login } from '@/services/authService'
import { ROLE_HOME } from '@/components/layouts/RoleGuard'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await login(email, password)
      const { access_token, user } = data.data
      setAuth(access_token, user)
      navigate(ROLE_HOME[user.role] ?? '/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-6">
            <BuildingOffice2Icon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Magic Management</h1>
          <p className="text-blue-200 text-base leading-relaxed max-w-xs mx-auto">
            The all-in-one business platform — manage orders, rooms, staff, and grow your Google reviews on autopilot.
          </p>

          <div className="mt-8 space-y-3 text-left max-w-xs mx-auto">
            {[
              { icon: <SparklesIcon className="w-4 h-4 text-white shrink-0 mt-0.5" />, label: 'Smart Google Reviews', sub: 'AI-generated suggestions that get customers to actually leave reviews' },
              { icon: '🍽', label: 'Restaurant & POS', sub: 'Table orders, kitchen display, billing & invoices' },
              { icon: '🏨', label: 'Hotel & Rooms', sub: 'Bookings, check-in/out, room service charges' },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
                <span className="text-lg leading-none mt-0.5 shrink-0">{f.icon}</span>
                <div>
                  <p className="text-white text-sm font-semibold">{f.label}</p>
                  <p className="text-blue-300 text-xs mt-0.5 leading-relaxed">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-blue-400 text-xs mt-8 max-w-xs mx-auto leading-relaxed">
            Works for restaurants, hotels, cafés, salons, retail stores — any business that wants more 5-star reviews.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <BuildingOffice2Icon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Magic Management</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <div className="w-4 h-4 rounded-full bg-red-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
              </div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Email</label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            Powered by Magic Management Platform
          </p>
        </div>
      </div>
    </div>
  )
}
