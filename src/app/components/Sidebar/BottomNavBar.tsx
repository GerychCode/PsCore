'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { sidebarMenuConfig } from '@/config/sidebar.menu'
import { IconType } from 'react-icons'

export function BottomNavBar() {
    const pathname = usePathname()

    return (
        <motion.nav
            className='fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-secondary/10 shadow-lg z-20'
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
            <ul className='flex justify-around items-center h-full'>
                {sidebarMenuConfig.map((item, index) => {
                    const Icon = item.icon as IconType | undefined
                    const isActive = pathname === item.path

                    return (
                        <li key={index} className='flex-1'>
                            <Link
                                href={item.path}
                                className={`flex w-full flex-col items-center justify-center p-2 transition-colors duration-200
                                ${
                                    isActive
                                        ? 'text-primary'
                                        : 'text-secondary hover:text-primary'
                                }
                                `}
                            >
                                {Icon && <Icon className='text-2xl' />}
                                <div
                                    className={`text-xs mt-1 w-full text-center font-medium
                                    `}
                                >
                                    {item.title}
                                </div>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </motion.nav>
    )
}