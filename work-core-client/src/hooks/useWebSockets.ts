import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { userStore } from '@/store/user.store'

export const useWebSockets = () => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const user = userStore((state) => state.user)

  useEffect(() => {
    if (!user?.id) return

    const socketInstance = io(
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
      {
        query: { userId: user.id },
        withCredentials: true,
      }
    )

    setSocket(socketInstance)

    // Слухаємо подію 'new_notification'
    socketInstance.on(
      'new_notification',
      (data: { title: string; message: string; type?: string }) => {
        console.log('Отримано повідомлення:', data)

        // 1. Програємо звук
        try {
          const audio = new Audio('/notification.mp3')
          audio.play().catch((e) => {
            // Браузери можуть блокувати автовідтворення, якщо користувач ще не клікав по сторінці
            console.warn('Autoplay prevented by browser', e)
          })
        } catch (error) {
          console.error('Помилка відтворення звуку', error)
        }

        alert(`🔔 ${data.title}\n${data.message}`)
      }
    )

    return () => {
      socketInstance.off('new_notification')
      socketInstance.disconnect()
    }
  }, [user?.id])

  return socket
}
