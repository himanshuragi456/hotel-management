import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => set({ token, user }),

      setSubscriptionAlert: (alert) => set(s => ({ user: s.user ? { ...s.user, subscription_alert: alert } : s.user })),

      logout: () => set({ token: null, user: null }),

      isAuthenticated: () => !!get().token,

      getRole: () => get().user?.role ?? null,

      getTenantId: () => get().user?.tenant_id ?? null,

      getSubscriptionAlert: () => get().user?.subscription_alert ?? null,
    }),
    {
      name: 'hotel-auth',
    }
  )
)

export default useAuthStore
