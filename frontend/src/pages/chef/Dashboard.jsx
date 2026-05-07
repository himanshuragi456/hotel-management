import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getKitchenOrders, updateOrderStatus } from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import { logout as logoutApi } from '@/services/authService'
import { useNavigate } from 'react-router-dom'
import Pusher from 'pusher-js'

const STATUS_FLOW = { pending: 'preparing', preparing: 'ready' }
const STATUS_LABEL = { pending: 'Start Preparing', preparing: 'Mark Ready' }

const urgencyStyle = (mins, status) => {
  if (status === 'ready') return 'border-green-500 bg-green-950'
  if (mins > 30) return 'border-red-500 bg-red-950'
  if (mins > 15) return 'border-yellow-500 bg-yellow-950'
  return 'border-blue-500 bg-gray-900'
}

function OrderCard({ order, onStatusChange }) {
  const next = STATUS_FLOW[order.status]
  return (
    <div className={`rounded-2xl border-l-4 p-4 ${urgencyStyle(order.elapsed_minutes, order.status)}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-white font-bold text-lg">Table {order.table?.number ?? 'Room'}</span>
          <div className="text-gray-400 text-xs mt-0.5">{order.order_number}</div>
        </div>
        <div className="text-right">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            order.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
            order.status === 'preparing' ? 'bg-blue-900 text-blue-300' :
            'bg-green-900 text-green-300'
          } capitalize`}>{order.status}</span>
          <div className={`text-xs mt-1 font-mono ${order.elapsed_minutes > 30 ? 'text-red-400' : 'text-gray-400'}`}>
            {order.elapsed_minutes}m ago
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        {order.items?.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-orange-400 font-bold text-sm min-w-[2rem]">{item.quantity}×</span>
            <div>
              <div className="text-white text-sm">{item.item_name}</div>
              {item.notes && <div className="text-yellow-300 text-xs italic">⚠ {item.notes}</div>}
            </div>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="text-yellow-200 text-xs bg-yellow-900/30 rounded-lg px-3 py-2 mb-3 italic">
          Order note: {order.notes}
        </div>
      )}

      {next && (
        <button
          onClick={() => onStatusChange(order.id, next)}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold ${
            next === 'preparing' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
        >
          {STATUS_LABEL[order.status]}
        </button>
      )}
    </div>
  )
}

export default function ChefDashboard() {
  const { user, logout: clearAuth, getTenantId } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const audioRef = useRef(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const tenantId = getTenantId?.()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: () => getKitchenOrders().then(r => r.data.data),
    refetchInterval: 15000,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => updateOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
  })

  // Pusher realtime
  useEffect(() => {
    if (!tenantId) return

    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER ?? 'ap2',
    })

    const channel = pusher.subscribe(`tenant.${tenantId}.kitchen`)
    channel.bind('order.updated', () => {
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] })
      if (soundEnabled && audioRef.current) {
        audioRef.current.play().catch(() => {})
      }
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`tenant.${tenantId}.kitchen`)
    }
  }, [tenantId, soundEnabled, qc])

  const handleLogout = async () => {
    try { await logoutApi() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  const pending   = orders?.filter(o => o.status === 'pending')   ?? []
  const preparing = orders?.filter(o => o.status === 'preparing') ?? []
  const ready     = orders?.filter(o => o.status === 'ready')     ?? []

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* hidden audio ping */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/ding.mp3" type="audio/mpeg" />
      </audio>

      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">Kitchen</h1>
          <span className="text-gray-500 text-sm">{user?.name}</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setSoundEnabled(s => !s)} className={`text-xs px-3 py-1.5 rounded-full ${soundEnabled ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
            {soundEnabled ? '🔔 Sound on' : '🔕 Sound off'}
          </button>
          <button onClick={handleLogout} className="text-sm text-red-400 hover:underline">Logout</button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-gray-500">Loading orders…</div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pending column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-semibold text-yellow-300 uppercase text-xs tracking-widest">Pending</h2>
              <span className="bg-yellow-900 text-yellow-300 text-xs px-2 py-0.5 rounded-full font-bold">{pending.length}</span>
            </div>
            <div className="space-y-3">
              {pending.map(o => <OrderCard key={o.id} order={o} onStatusChange={(id, status) => updateStatus.mutate({ id, status })} />)}
              {!pending.length && <div className="text-center py-8 text-gray-700 text-sm border border-dashed border-gray-800 rounded-xl">No pending orders</div>}
            </div>
          </div>

          {/* Preparing column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-semibold text-blue-300 uppercase text-xs tracking-widest">Preparing</h2>
              <span className="bg-blue-900 text-blue-300 text-xs px-2 py-0.5 rounded-full font-bold">{preparing.length}</span>
            </div>
            <div className="space-y-3">
              {preparing.map(o => <OrderCard key={o.id} order={o} onStatusChange={(id, status) => updateStatus.mutate({ id, status })} />)}
              {!preparing.length && <div className="text-center py-8 text-gray-700 text-sm border border-dashed border-gray-800 rounded-xl">Nothing being prepared</div>}
            </div>
          </div>

          {/* Ready column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-semibold text-green-300 uppercase text-xs tracking-widest">Ready</h2>
              <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full font-bold">{ready.length}</span>
            </div>
            <div className="space-y-3">
              {ready.map(o => <OrderCard key={o.id} order={o} onStatusChange={(id, status) => updateStatus.mutate({ id, status })} />)}
              {!ready.length && <div className="text-center py-8 text-gray-700 text-sm border border-dashed border-gray-800 rounded-xl">Nothing ready yet</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
