/* Service worker for Magic Management — handles Web Push so a sleeping or
   backgrounded phone still alerts on a new order. The OS plays the system
   notification sound; the in-app custom sound only applies while the tab is
   open and foregrounded (handled by useNotificationCenter, not here). */

self.addEventListener('install', (event) => {
  // Activate immediately so push works right after the first registration.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'New alert', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Magic Management'
  const options = {
    body: payload.body || '',
    icon: '/logo-icon.png',
    badge: '/logo-icon.png',
    // Vibrate on phones that support it.
    vibrate: [200, 100, 200],
    // Coalesce repeats of the same kind so the tray doesn't flood.
    tag: payload.kind || 'magic-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: '/', ...(payload.data || {}) },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an already-open tab if there is one, else open a new one.
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
