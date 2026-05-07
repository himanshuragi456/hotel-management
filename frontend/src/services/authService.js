import api from './api'

export const login = (email, password) =>
  api.post('/auth/login', { email, password })

export const getMe = () => api.get('/auth/me')

export const logout = () => api.post('/auth/logout')

export const refresh = () => api.post('/auth/refresh')
