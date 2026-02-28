import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { IUser } from '@/interface/IUser'

interface UserStore {
    user: IUser | null
    isAdmin: boolean
    updateUser: (user: IUser) => void
    logout: () => void
}

export const userStore = create<UserStore>()(
    persist(
        (set) => ({
            user: null,
            isAdmin: false,
            updateUser: (user: IUser) =>
                set(() => ({
                    user,
                    isAdmin: user.role === 'Admin',
                })),
            logout: () => set({ user: null, isAdmin: false }),
        }),
        {
            name: 'workcore-user-storage', // Унікальне ім'я ключа в localStorage
            storage: createJSONStorage(() => localStorage), // Використовуємо localStorage
        }
    )
)