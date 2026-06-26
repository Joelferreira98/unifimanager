import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  name: string
  email: string
  role: 'MASTER' | 'MANAGER' | 'SELLER'
  companyId?: string | null
  canViewGlobalReports?: boolean
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  updateUser: (partial: Partial<AuthUser>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (partial) =>
        set((state) => ({ user: state.user ? { ...state.user, ...partial } : state.user })),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'unifi-auth' }
  )
)
