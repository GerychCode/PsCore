import { create } from 'zustand'
import { chatService } from '@/service/chat.service'

interface ChatStore {
  unreadTotal: number
  setUnread: (n: number) => void
  increment: () => void
  refresh: () => Promise<void>
  reset: () => void
}

export const chatStore = create<ChatStore>((set) => ({
  unreadTotal: 0,
  setUnread: (n: number) => set({ unreadTotal: Math.max(0, n) }),
  increment: () => set((state) => ({ unreadTotal: state.unreadTotal + 1 })),
  refresh: async () => {
    try {
      const { data } = await chatService.getUnreadCount()
      set({ unreadTotal: Math.max(0, data.count) })
    } catch {
      // не критично для UI
    }
  },
  reset: () => set({ unreadTotal: 0 }),
}))
