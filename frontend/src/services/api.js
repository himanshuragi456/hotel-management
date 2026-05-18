import axios from 'axios'
import useAuthStore from '@/store/authStore'
import { AUTH_EXPIRED_EVENT, API_ERROR_EVENT } from '@/components/shared/GlobalErrorModal'

export const SUBSCRIPTION_EXPIRED_EVENT = 'subscription:expired'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 — attempt refresh, else logout
let refreshing = false
let queue = []

const processQueue = (error, token = null) => {
  queue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)))
  queue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      // On the login route itself a 401 just means wrong credentials — don't show session-expired modal
      if (original.url?.includes('/auth/login')) {
        return Promise.reject(error)
      }
      // No token stored — nothing to refresh, show modal immediately
      if (!useAuthStore.getState().token) {
        useAuthStore.getState().logout()
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
        return Promise.reject(error)
      }

      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        }).catch((err) => Promise.reject(err))
      }

      original._retry = true
      refreshing = true

      try {
        const { data } = await api.post('/auth/refresh')
        const newToken = data.data.access_token
        useAuthStore.getState().setAuth(newToken, useAuthStore.getState().user)
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (err) {
        processQueue(err, null)
        useAuthStore.getState().logout()
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
        return Promise.reject(err)
      } finally {
        refreshing = false
      }
    }

    // 402 — subscription expired
    if (error.response?.status === 402 && error.response.data?.message === 'subscription_expired') {
      window.dispatchEvent(new CustomEvent(SUBSCRIPTION_EXPIRED_EVENT, {
        detail: { branding: error.response.data.branding }
      }))
      return Promise.reject(error)
    }

    // Non-401 server errors — fire API error event
    if (error.response && error.response.status >= 500) {
      const message = error.response.data?.message || 'A server error occurred. Please try again.'
      window.dispatchEvent(new CustomEvent(API_ERROR_EVENT, { detail: { message } }))
    }

    return Promise.reject(error)
  }
)

export default api
