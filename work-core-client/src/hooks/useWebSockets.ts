import { userStore } from '@/store/user.store'
import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AppNotification } from '@/app/(isAuth)/layout'
import { IChatMessage } from '@/interface/IChat'
import { PathConfig } from '@/config/path.config'

export const useWebSockets = (
  onNotification: (notif: AppNotification) => void
) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const user = userStore((state) => state.user)
  const router = useRouter()

  useEffect(() => {
    if (!user?.id) return

    // Автентифікація сокета відбувається за session-кукі (withCredentials)
    const socketInstance: Socket = io(
      process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3022',
      {
        withCredentials: true,
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

      onNotification(newNotification as AppNotification)
    })

    socketInstance.on('chat:message', (message: IChatMessage) => {
      // Тост лише для вхідних і коли чат не відкритий — там повідомлення й так видно
      if (message.senderId === user.id) return
      if (window.location.pathname.startsWith(PathConfig.CHAT)) return

      try {
        new Audio('/notification.mp3').play().catch(() => {})
      } catch (error) {}

      const senderName = message.sender
        ? `${message.sender.firstName} ${message.sender.lastName}`
        : 'Нове повідомлення'
      const preview =
        message.content.length > 80
          ? `${message.content.slice(0, 80)}…`
          : message.content

      toast(`💬 ${senderName}`, {
        description: preview,
        duration: 5000,
        action: {
          label: 'Відкрити',
          onClick: () => router.push(PathConfig.CHAT),
        },
      })
    })

    socketInstance.on('invalidate_shifts', () => {
      window.dispatchEvent(new CustomEvent('invalidate_shifts'))
    })

    socketInstance.on('invalidate_schedules', () => {
      window.dispatchEvent(new CustomEvent('invalidate_schedules'))
    })

    return () => {
      socketInstance.off('new_notification')
      socketInstance.off('chat:message')
      socketInstance.off('invalidate_shifts')
      socketInstance.off('invalidate_schedules')
      socketInstance.disconnect()
    }
  }, [user?.id, onNotification])

  return socket
}
