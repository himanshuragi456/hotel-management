import { Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'

const ROLE_HOME = {
  superadmin: '/superadmin',
  owner:      '/owner',
  waiter:     '/waiter',
  chef:       '/chef',
  billing:    '/billing',
}

export function RequireAuth({ children, roles }) {
  const { token, user } = useAuthStore()

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />
  }

  return children
}

export function RedirectIfAuth() {
  const { token, user } = useAuthStore()

  if (token && user) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />
  }

  return null
}

export { ROLE_HOME }
