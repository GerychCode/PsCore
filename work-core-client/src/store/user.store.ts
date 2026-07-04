import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { IUser } from '@/interface/IUser'

interface UserStore {
    user: IUser | null
    isAdmin: boolean
    permissions: string[]
    updateUser: (user: IUser) => void
    hasPermission: (permission: string) => boolean
    logout: () => void
}

const computeIsAdmin = (user: IUser) =>
    user.role === 'Admin' || (user.permissions ?? []).includes('ADMINISTRATOR')

export const userStore = create<UserStore>()(
    persist(
        (set, get) => ({
            user: null,
            isAdmin: false,
            permissions: [],
            updateUser: (user: IUser) =>
                set(() => ({
                    user,
                    isAdmin: computeIsAdmin(user),
                    permissions: user.permissions ?? [],
                })),
            hasPermission: (permission: string) => {
                const state = get()
                if (state.isAdmin) return true
                return state.permissions.includes(permission)
            },
            logout: () => set({ user: null, isAdmin: false, permissions: [] }),
        }),
        {
            name: 'workcore-user-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
