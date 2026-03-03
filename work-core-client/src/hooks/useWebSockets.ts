import { userStore } from '@/store/user.store'
import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { AppNotification } from '@/app/(isAuth)/layout'

export const useWebSockets = (
  onNotification: (notif: AppNotification) => void
) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const user = userStore((state) => state.user)

  useEffect(() => {
    if (!user?.id) return

    const socketInstance: Socket = io(
      process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3022',
      {
        withCredentials: true,
        query: { userId: user.id },
      }
    )

    setSocket(socketInstance)

    socketInstance.on('new_notification', (data: AppNotification) => {
      try {
        new Audio('/notification.mp3').play().catch(() => {})
      } catch (error) {}

      const newNotification = {
        ...data,
        id: data.id || Date.now() + Math.random(),
      }

      // Передаємо нове сповіщення нагору
      onNotification(newNotification as AppNotification)
    })

    socketInstance.on('invalidate_shifts', () => {
      window.dispatchEvent(new CustomEvent('invalidate_shifts'))
    })

    return () => {
      socketInstance.off('new_notification')
      socketInstance.off('invalidate_shifts')
      socketInstance.disconnect()
    }
  }, [user?.id, onNotification])

  return socket
}
