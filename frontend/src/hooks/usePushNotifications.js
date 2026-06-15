import { useCallback, useEffect, useState } from 'react'
import api from '@/services/api'

/**
 * Manages OS-level Web Push so a sleeping/backgrounded phone still alerts on a
 * new order. Distinct from useNotificationCenter (in-app foreground sound).
 *
 * Flow: register service worker → request permission → subscribe with the
 * server's VAPID public key → POST the subscription to the backend. The chef
 * taps "Enable phone alerts" once per device; on iPhone the app must first be
 * installed via Add to Home Screen (Apple restriction).
 *
 * Returns:
 *   supported   — browser can do push at all
 *   needsInstall— iOS Safari not yet installed as a PWA (push unavailable until then)
 *   status      — 'default' | 'granted' | 'denied' | 'unsupported'
 *   subscribed  — this device currently has an active subscription
 *   enable()    — request permission + subscribe (call from a user tap)
 *   disable()   — remove this device's subscription
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent)

export function usePushNotifications() {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  // iOS only allows push when the app has been installed to the home screen.
  const needsInstall = supported && isIos() && !isStandalone()

  const [status, setStatus] = useState(
    supported ? Notification.permission : 'unsupported'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  // Register the SW up front and reflect any existing subscription.
  useEffect(() => {
    if (!supported) return
    let cancelled = false
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (!cancelled) setSubscribed(!!sub) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [supported])

  const enable = useCallback(async () => {
    if (!supported || busy) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setStatus(perm)
      if (perm !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const { data } = await api.get('/push/vapid-key')
      const key = data?.data?.key
      if (!key) return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })

      const json = sub.toJSON()
      await api.post('/push/subscribe', {
        endpoint: json.endpoint,
        keys: json.keys, // { p256dh, auth }
      })
      setSubscribed(true)
    } catch (e) {
      // swallow — UI shows the unchanged status
    } finally {
      setBusy(false)
    }
  }, [supported, busy])

  const disable = useCallback(async () => {
    if (!supported) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch { /* ignore */ }
  }, [supported])

  return { supported, needsInstall, status, subscribed, busy, enable, disable }
}
