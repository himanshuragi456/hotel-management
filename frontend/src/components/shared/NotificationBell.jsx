import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications, markNotifRead, clearNotifications, deleteNotification,
} from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import {
  BellIcon, BellAlertIcon, SpeakerWaveIcon, SpeakerXMarkIcon, XMarkIcon,
} from '@heroicons/react/24/outline'

const TYPE_ICON = {
  new_order:       '🍽️',
  new_kot:         '👨‍🍳',
  order_new:       '🍽️',
  order_ready:     '✅',
  bill_requested:  '🧾',
  payment_claimed: '💸',
  mt_order:        '📲',
  mt_paid:         '💸',
  waiter_called:   '🙋',
  booking_new:     '📅',
  checkout_due:    '🔔',
  low_stock:       '⚠️',
  default:         '📣',
}

/**
 * Notification center bell.
 *
 * @param {object} [sound]  controls from useNotificationCenter:
 *   { muted, toggleMute, stopSound, playing }. When passed, the drawer shows a
 *   sound on/off switch (this device) and a Stop button while a sound is ringing.
 */
export default function NotificationBell({ sound }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const qc  = useQueryClient()
  const { isAuthenticated } = useAuthStore()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications().then(r => r.data.data),
    // Ably refetches this on every event (useNotificationCenter) — no polling.
    // TTL decay for the unread count is handled purely client-side below.
    enabled: isAuthenticated(),
  })

  // Re-evaluate age every 30s so expired items vanish between server polls too.
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // Notifications auto-expire after 10 minutes (mirrors the backend TTL).
  const TTL_MS = 10 * 60 * 1000
  const fresh = (n) => Date.now() - new Date(n.created_at).getTime() < TTL_MS

  const notifications = (data?.notifications ?? []).filter(fresh)
  const unread        = notifications.filter(n => !n.is_read).length

  const markRead = useMutation({
    mutationFn: (id) => markNotifRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const cut = useMutation({
    mutationFn: (id) => deleteNotification(id),
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

  const ringing = sound?.playing

  const CONNECTION_DOT = {
    connected:    { color: 'bg-green-500',  label: 'Live — real-time updates connected' },
    connecting:   { color: 'bg-amber-400 animate-pulse', label: 'Connecting…' },
    disconnected: { color: 'bg-amber-400 animate-pulse', label: 'Reconnecting…' },
    suspended:    { color: 'bg-red-500',    label: 'Offline — real-time updates paused' },
    failed:       { color: 'bg-red-500',    label: 'Offline — real-time updates failed' },
    closed:       { color: 'bg-gray-400',   label: 'Disconnected' },
  }
  const dot = sound?.connectionState ? (CONNECTION_DOT[sound.connectionState] ?? CONNECTION_DOT.connecting) : null

  return (
    <div className="relative flex items-center gap-2" ref={ref}>
      {dot && (
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot.color}`} title={dot.label} />
      )}
      {/* Autoplay was blocked — clicking anything is itself the gesture that
          unlocks audio, so this pill just needs to be visible + clickable. */}
      {sound?.blocked && !sound?.muted && (
        <button
          onClick={() => { /* the click itself unlocks audio via the global listener */ }}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-300 animate-pulse"
          title="Click anywhere to enable notification sounds"
        >
          <SpeakerWaveIcon className="w-3.5 h-3.5" /> Enable sound
        </button>
      )}
      <button
        onClick={() => {
          setOpen(o => !o)
          if (!open && unread > 0) markRead.mutate(null)
        }}
        className={`relative p-2 rounded-lg transition-colors ${
          ringing ? 'text-orange-500 animate-pulse' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        title="Notifications"
      >
        {ringing ? <BellAlertIcon className="w-5 h-5" /> : <BellIcon className="w-5 h-5" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center font-bold leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-gray-900 text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {sound && (
                <button
                  onClick={sound.toggleMute}
                  title={sound.muted ? 'Sound off (this device)' : 'Sound on (this device)'}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                    sound.muted
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-green-50 text-green-600'
                  }`}
                >
                  {sound.muted
                    ? <SpeakerXMarkIcon className="w-3.5 h-3.5" />
                    : <SpeakerWaveIcon className="w-3.5 h-3.5" />}
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => clear.mutate()}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Ringing banner — quick stop without dismissing */}
          {ringing && (
            <button
              onClick={sound.stopSound}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 text-xs font-semibold border-b border-orange-100 hover:bg-orange-100"
            >
              <SpeakerXMarkIcon className="w-4 h-4" /> Stop sound
            </button>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <div className="text-3xl mb-2">🔕</div>
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${!n.is_read ? 'bg-orange-50/60' : ''}`}
                >
                  <span className="text-lg mt-0.5 shrink-0">{TYPE_ICON[n.type] ?? TYPE_ICON.default}</span>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => !n.is_read && markRead.mutate(n.id)}
                  >
                    <div className={`text-sm font-medium ${n.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
                      {n.title}
                    </div>
                    {n.body && <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>}
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-orange-500 mt-1" />}
                    <button
                      onClick={() => cut.mutate(n.id)}
                      title="Dismiss"
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
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
