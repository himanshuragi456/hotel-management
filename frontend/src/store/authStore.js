import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => set({ token, user }),

      logout: () => set({ token: null, user: null }),

      isAuthenticated: () => !!get().token,

      getRole: () => get().user?.role ?? null,

      getTenantId: () => get().user?.tenant_id ?? null,
    }),
    {
      name: 'hotel-auth',
    }
  )
)

export default useAuthStore
