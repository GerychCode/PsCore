
'use client'
import { IoIosMenu, IoIosSettings } from 'react-icons/io'
import { FaBell } from 'react-icons/fa'
import Profile from '@/app/components/user/Profile'
import { useMediaQuery } from '@/hooks/use-media-query'

interface IHeaderProps {
    routeName: string
    sideBarIsCollapsed: boolean
    SetSideBarIsCollapsed: (value: boolean) => void
}

export default function Header({
                                   routeName,
                                   sideBarIsCollapsed,
                                   SetSideBarIsCollapsed,
                               }: IHeaderProps) {
    const isMobile = useMediaQuery('(max-width: 768px)')

    return (
        <header className='h-20 w-full flex justify-between items-center p-5 bg-white border-b border-secondary/10'>
        <div className='flex flex-row items-center gap-5'>
            {!isMobile && (
        <IoIosMenu
            className='text-3xl hover:opacity-75 cursor-pointer text-secondary'
    onClick={() => SetSideBarIsCollapsed(!sideBarIsCollapsed)}
    />
)}
    <h1 className='text-2xl md:text-3xl font-bold text-black'>
        {routeName}
        </h1>
        </div>

        <div className='flex items-center justify-center gap-4 md:gap-6'>
    <FaBell className='text-xl md:text-2xl hover:opacity-75 cursor-pointer text-secondary' />
    <IoIosSettings className='text-2xl md:text-3xl hover:opacity-75 cursor-pointer text-secondary' />
        <Profile />
        </div>
        </header>
)
}