import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markNotifRead, clearNotifications } from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'

const TYPE_ICON = {
  order_new:    '🍽',
  order_ready:  '✅',
  booking_new:  '📅',
  checkout_due: '🔔',
  low_stock:    '⚠️',
  default:      '📣',
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const qc  = useQueryClient()
  const { isAuthenticated } = useAuthStore()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications().then(r => r.data.data),
    refetchInterval: 30000,
    enabled: isAuthenticated(),
  })

  const notifications = data?.notifications ?? []
  const unread        = data?.unread_count  ?? 0

  const markRead = useMutation({
    mutationFn: (id) => markNotifRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const clear = useMutation({
    mutationFn: clearNotifications,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(o => !o)
          if (!open && unread > 0) markRead.mutate(null)
        }}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-gray-900 text-sm">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={() => clear.mutate()}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <div className="text-3xl mb-2">🔕</div>
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer ${!n.is_read ? 'bg-orange-50' : ''}`}
                  onClick={() => !n.is_read && markRead.mutate(n.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{TYPE_ICON[n.type] ?? TYPE_ICON.default}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${n.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
                        {n.title}
                      </div>
                      {n.body && <div className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</div>}
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
