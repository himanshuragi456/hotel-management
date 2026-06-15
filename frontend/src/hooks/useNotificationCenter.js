import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Pusher from 'pusher-js'
import useAuthStore from '@/store/authStore'

// ─── Sound mapping ──────────────────────────────────────────────────────────
// Each alert kind maps to a dedicated MP3 dropped in /public/sounds. Kinds
// without their own file fall back to a sensible generic ping.
const SOUND = {
  new_order:       '/sounds/new-order.mp3',
  new_kot:         '/sounds/new-kot.mp3',
  bill_requested:  '/sounds/bill-requested.mp3',
  payment_claimed: '/sounds/payment-claimed.mp3',
  mt_order:        '/sounds/mt-order.mp3',
  waiter_called:   '/sounds/new-order.mp3', // no dedicated sound — generic floor ping
  mt_paid:         '/sounds/payment-claimed.mp3',
  order_ready:     '/sounds/new-order.mp3', // no dedicated sound — generic floor ping
}

// Which kinds each role should actually be alerted (ring + count) about.
// Backend already targets DB rows per-role, but the realtime ring is filtered
// here so e.g. a chef doesn't ring for a bill-request that isn't theirs.
// Owner is intentionally absent — owners do not get floor/order alerts.
const ROLE_KINDS = {
  billing: ['new_order', 'bill_requested', 'payment_claimed', 'mt_order', 'mt_paid', 'waiter_called', 'order_ready'],
  chef:    ['new_kot'],
  waiter:  ['waiter_called', 'bill_requested', 'order_ready'],
}

const MUTE_KEY = (role) => `notif_muted_${role || 'all'}`

function buildPusher() {
  const cfg = { cluster: import.meta.env.VITE_PUSHER_CLUSTER ?? 'mt1' }
  if (import.meta.env.VITE_PUSHER_HOST) {
    cfg.wsHost = import.meta.env.VITE_PUSHER_HOST
    cfg.wsPort = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
    cfg.wssPort = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
    cfg.forceTLS = (import.meta.env.VITE_PUSHER_SCHEME ?? 'http') === 'https'
    cfg.disableStats = true
    cfg.enabledTransports = ['ws']
  }
  return new Pusher(import.meta.env.VITE_PUSHER_KEY, cfg)
}

/**
 * Central front-of-house notification engine. Mount once per dashboard.
 *
 * - Subscribes to the tenant kitchen channel.
 * - On a `table.activity` event for a kind this role cares about, it plays the
 *   matching sound (once, full length ~10-12s) and refreshes the DB-backed bell
 *   list so the notification appears and survives refresh.
 * - On `order.updated` it just refreshes order queries (sound for new orders is
 *   driven by the explicit `table.activity` new_order/new_kot events).
 * - Global mute is per-device (localStorage) and personal to this role.
 *
 * Returns { muted, toggleMute, stopSound, playing } for a sound control button.
 */
export function useNotificationCenter({ extraInvalidateKeys = [] } = {}) {
  const qc = useQueryClient()
  const { user, getTenantId } = useAuthStore()
  const tenantId = getTenantId?.()
  const role = user?.role

  const audioRef = useRef(null)      // the single reused <audio> element
  const audioCtxRef = useRef(null)   // shared WebAudio context (unlocked on gesture)
  const mutedRef = useRef(false)
  const unlockedRef = useRef(false)

  // One reused <audio> element for the whole session. Reusing the SAME element
  // that was unlocked by a gesture is what lets mobile play later, event-driven
  // sounds — a fresh `new Audio()` per alert stays blocked on iOS.
  const getAudioEl = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio()
      el.preload = 'auto'
      audioRef.current = el
    }
    return audioRef.current
  }, [])
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY(role)) === '1' } catch { return false }
  })
  const [playing, setPlaying] = useState(false)
  // True when the browser blocked a sound for lack of a user gesture — the UI
  // can then nudge the user to click once to enable sound.
  const [blocked, setBlocked] = useState(false)

  useEffect(() => { mutedRef.current = muted }, [muted])

  // Browsers (especially iOS Safari / Android Chrome) block programmatic audio
  // until the user has interacted with the page. We unlock on the first gesture
  // by (a) resuming a shared AudioContext and (b) play+pausing a silent buffer
  // on a REUSED <audio> element. Later websocket-triggered sounds reuse that
  // same unlocked element (see playFor), which is what mobile actually requires
  // — a fresh `new Audio()` per alert stays blocked on iOS.
  useEffect(() => {
    const unlock = () => {
      // Resume a shared WebAudio context (mobile needs this on a gesture).
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (Ctx) {
          if (!audioCtxRef.current) audioCtxRef.current = new Ctx()
          if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume().catch(() => {})
        }
      } catch { /* ignore */ }

      // Prime the reusable <audio> element within the gesture.
      const el = getAudioEl()
      const prevVol = el.volume
      el.volume = 0
      el.muted = true
      el.play().then(() => {
        el.pause(); el.currentTime = 0; el.muted = false; el.volume = prevVol
        unlockedRef.current = true
        setBlocked(false)
      }).catch(() => {
        el.muted = false; el.volume = prevVol
        // not unlocked yet — listeners stay attached, retry on next gesture
      })
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('touchend', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchend', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const stopSound = useCallback(() => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    setPlaying(false)
  }, [])

  const playFor = useCallback((kind) => {
    if (mutedRef.current) return
    const src = SOUND[kind]
    if (!src) return
    // Reuse the same element that the gesture unlocked (critical for mobile).
    const el = getAudioEl()
    el.pause(); el.currentTime = 0
    el.src = src
    el.volume = 1
    el.muted = false
    el.onended = () => setPlaying(false)
    el.play()
      .then(() => { setPlaying(true); setBlocked(false); unlockedRef.current = true })
      .catch((err) => {
        // Autoplay denied (no user gesture yet) — flag it so the UI can prompt.
        if (err?.name === 'NotAllowedError') setBlocked(true)
        setPlaying(false)
      })
  }, [getAudioEl])

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m
      try { localStorage.setItem(MUTE_KEY(role), next ? '1' : '0') } catch { /* ignore */ }
      if (next) stopSound()
      return next
    })
  }, [role, stopSound])

  // Called from an explicit user tap (e.g. the "enable sound" banner) — this IS
  // a valid gesture, so resume the context and play a short confirmation ping.
  // After this, websocket-triggered sounds are allowed on mobile.
  const enableSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (Ctx) {
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx()
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume().catch(() => {})
      }
    } catch { /* ignore */ }
    const el = getAudioEl()
    el.pause(); el.currentTime = 0
    el.src = SOUND.new_order
    el.volume = 1
    el.muted = false
    el.onended = () => setPlaying(false)
    el.play()
      .then(() => { unlockedRef.current = true; setBlocked(false); setPlaying(true) })
      .catch(() => { /* still blocked — banner stays */ })
  }, [getAudioEl])

  // keep stable refs for the keys so the effect doesn't re-subscribe each render
  const extraKeysRef = useRef(extraInvalidateKeys)
  useEffect(() => { extraKeysRef.current = extraInvalidateKeys })

  useEffect(() => {
    if (!tenantId) return
    const allowed = ROLE_KINDS[role] ?? []
    const pusher = buildPusher()
    const channel = pusher.subscribe(`tenant.${tenantId}.kitchen`)

    const refreshOrders = () => {
      extraKeysRef.current.forEach(k => qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] }))
    }

    channel.bind('table.activity', (data) => {
      const kind = data?.kind
      refreshOrders()

      const shouldRing = kind && allowed.includes(kind) &&
        // The user who triggered the action doesn't get alerted about their own action.
        !(data?.exclude_user_id && data.exclude_user_id === user?.id) &&
        // Waiter alerts may target a specific waiter; if so, only that waiter rings.
        !(role === 'waiter' && data?.waiter_id && data.waiter_id !== user?.id)

      // Refresh the bell FIRST, then ring — so the sound never precedes the
      // notification appearing in the box. refetch() resolves once the list is
      // updated; the sound plays only after.
      qc.refetchQueries({ queryKey: ['notifications'] }).finally(() => {
        if (shouldRing) playFor(kind)
      })
    })

    channel.bind('order.updated', () => {
      refreshOrders()
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`tenant.${tenantId}.kitchen`)
    }
  }, [tenantId, role, user?.id, qc, playFor])

  return { muted, toggleMute, stopSound, playing, blocked, enableSound }
}
