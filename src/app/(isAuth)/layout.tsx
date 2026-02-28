'use client'
import { useEffect, useMemo, useState } from 'react'
import { IoIosMenu, IoIosSettings } from 'react-icons/io'
import { Sidebar } from '@/app/components/Sidebar/Sidebar'
import { FaBell } from 'react-icons/fa'
import Profile from '@/app/components/user/Profile'
import { useGetUserMutation } from '@/hooks/user/get.user.mutation'
import { PathConfig, routeLabels } from '@/config/path.config' // <-- Додано PathConfig
import { usePathname } from 'next/navigation'
import Link from 'next/link' // <-- Додано

export default function Layout({
                                 children,
                               }: Readonly<{
  children: React.ReactNode
}>) {
  const { mutate, isPending } = useGetUserMutation()
  const [sideBarIsCollapsed, SetSideBarIsCollapsed] = useState(false)
  const pathname = usePathname()

  const routeName = useMemo(() => {
    return routeLabels[pathname] || 'Невідомий маршрут'
  }, [pathname])

  useEffect(() => {
    mutate()
  }, [])
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
              <FaBell className='text-2xl hover:opacity-75 cursor-pointer text-secondary' />
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