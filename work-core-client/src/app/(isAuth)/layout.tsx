'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { IoIosMenu, IoIosSettings } from 'react-icons/io'
import { Sidebar } from '@/app/components/Sidebar/Sidebar'
import { FaBell, FaTrash } from 'react-icons/fa'
import Profile from '@/app/components/user/Profile'
import { useGetUserMutation } from '@/hooks/user/get.user.mutation'
import { PathConfig, routeLabels } from '@/config/path.config'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { io, Socket } from 'socket.io-client'
import { axiosClassic } from '@/api/interceptors'

export interface AppNotification {
  id: number
  title: string
  message: string
  isRead: boolean
  type: string
  createdAt: string | Date
}

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { mutate, data: userData } = useGetUserMutation()
  const [sideBarIsCollapsed, SetSideBarIsCollapsed] = useState(false)
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const routeName = useMemo(() => routeLabels[pathname] || '', [pathname])

  useEffect(() => {
    mutate()
  }, [])

  useEffect(() => {
    if (!userData?.id) return
    const fetchNotifications = async () => {
      try {
        const response =
          await axiosClassic.get<AppNotification[]>('/notifications')
        setNotifications(response.data)
      } catch (error) {}
    }
    fetchNotifications()
  }, [userData?.id])

  useEffect(() => {
    if (!userData?.id) return
    const socket: Socket = io(
      process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3022',
      {
        withCredentials: true,
        query: { userId: userData.id },
      }
    )

    socket.on('new_notification', (data: AppNotification) => {
      try {
        new Audio('/notification.mp3').play().catch(() => {})
      } catch (error) {}

      const newNotification = {
        ...data,
        id: data.id || Date.now() + Math.random(),
      }
      setNotifications((prev) => [newNotification as AppNotification, ...prev])
    })

    return () => {
      socket.off('new_notification')
      socket.disconnect()
    }
  }, [userData?.id])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleBellClick = async () => {
    const willOpen = !isDropdownOpen
    setIsDropdownOpen(willOpen)

    if (willOpen && unreadCount > 0) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      try {
        await axiosClassic.patch('/notifications/read-all')
      } catch (error) {}
    }
  }

  const handleDeleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      await axiosClassic.delete(`/notifications/${id}`)
    } catch (error) {}
  }

  return (
    <main className='flex flex-row w-full h-full'>
      <Sidebar collapsed={sideBarIsCollapsed} />
      <section className='flex flex-col w-full z-0'>
        <div className='h-full max-h-20 w-full flex justify-between items-center p-5'>
          <div className='flex flex-row items-center justify-between gap-5'>
            <IoIosMenu
              className='text-3xl hover:opacity-75 cursor-pointer text-secondary'
              onClick={() => SetSideBarIsCollapsed(!sideBarIsCollapsed)}
            />
            <h1 className='text-3xl font-bold'>{routeName}</h1>
          </div>

          <div className='flex items-center justify-between gap-6'>
            <div
              className='relative flex items-center justify-center'
              ref={dropdownRef}
            >
              <div
                onClick={handleBellClick}
                className='relative cursor-pointer'
              >
                <FaBell
                  className={`text-2xl transition-colors duration-300 ${
                    unreadCount > 0
                      ? 'text-red-500'
                      : 'text-secondary hover:opacity-75'
                  }`}
                />
                {unreadCount > 0 && (
                  <span className='absolute -top-1 -right-1 flex h-3 w-3'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-3 w-3 bg-red-500'></span>
                  </span>
                )}
              </div>

              {isDropdownOpen && (
                <div className='absolute top-10 right-0 w-[340px] bg-white shadow-2xl rounded-xl border border-gray-100 p-0 z-50 overflow-hidden flex flex-col'>
                  <div className='px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center'>
                    <span className='font-semibold text-gray-700 text-sm'>
                      Сповіщення
                    </span>
                    <span className='bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase'>
                      Всього: {notifications.length}
                    </span>
                  </div>

                  <ul className='max-h-[170px] overflow-y-auto custom-scrollbar'>
                    {notifications.length === 0 ? (
                      <li className='p-6 text-center text-gray-400 text-sm'>
                        Немає нових сповіщень
                      </li>
                    ) : (
                      notifications.map((n, index) => (
                        <li
                          key={`notif-${n.id}-${index}`}
                          className='group relative p-4 border-b border-gray-50 hover:bg-slate-50 transition-colors flex flex-col gap-1'
                        >
                          <div className='flex justify-between items-start'>
                            <span className='font-semibold text-gray-800 text-sm pr-6'>
                              {n.title}
                            </span>
                            <button
                              onClick={(e) => handleDeleteNotification(e, n.id)}
                              className='text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4'
                            >
                              <FaTrash size={12} />
                            </button>
                          </div>
                          <span className='text-xs text-gray-500 line-clamp-2 leading-relaxed'>
                            {n.message}
                          </span>
                          <span className='text-[10px] text-gray-400 text-right mt-1'>
                            {new Date(n.createdAt).toLocaleString('uk-UA', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <Link href={PathConfig.SETTINGS}>
              <IoIosSettings className='text-3xl hover:opacity-75 cursor-pointer text-secondary' />
            </Link>
            <Profile />
          </div>
        </div>
        <section className='flex-grow overflow-y-auto p-5'>{children}</section>
      </section>
    </main>
  )
}
