import axios from 'axios'
import useAuthStore from '@/store/authStore'

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

    if (error.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
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
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        refreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
