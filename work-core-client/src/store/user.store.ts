import { create } from 'zustand'
import { IUser, NotificationPrefs } from '@/interface/IUser'

interface UserStore {
    user: IUser | null
    isAdmin: boolean
    permissions: string[]
    updateUser: (user: IUser) => void
    setNotificationPrefs: (prefs: NotificationPrefs) => void
    hasPermission: (permission: string) => boolean
    logout: () => void
}

const computeIsAdmin = (user: IUser) =>
    user.role === 'Admin' || (user.permissions ?? []).includes('ADMINISTRATOR')

// Без persist: дані користувача (роль/права) підтягуються getUser при кожному
// маунті layout. Persist давав hydration mismatch — на SSR прав немає, а в
// localStorage вони вже є. Порожній старт на обох боках усуває розбіжність.
export const userStore = create<UserStore>((set, get) => ({
    user: null,
    isAdmin: false,
    permissions: [],
    updateUser: (user: IUser) =>
        set(() => ({
            user,
            isAdmin: computeIsAdmin(user),
            permissions: user.permissions ?? [],
        })),
    setNotificationPrefs: (prefs: NotificationPrefs) =>
        set((state) =>
            state.user
                ? { user: { ...state.user, notificationPrefs: prefs } }
                : {}
        ),
    hasPermission: (permission: string) => {
        const state = get()
        if (state.isAdmin) return true
        return state.permissions.includes(permission)
    },
    logout: () => set({ user: null, isAdmin: false, permissions: [] }),
}))
