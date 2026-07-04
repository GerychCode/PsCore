'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { sidebarMenuConfig } from '@/config/sidebar.menu'
import { IconType } from 'react-icons'
import { chatStore } from '@/store/chat.store'
import { userStore } from '@/store/user.store'
import { PathConfig } from '@/config/path.config'

interface SidebarMenuProps {
    collapsed: boolean
}

export function SidebarMenu({ collapsed }: SidebarMenuProps) {
    const pathname = usePathname()
    const unreadTotal = chatStore((state) => state.unreadTotal)
    const hasPermission = userStore((state) => state.hasPermission)

    const menuItems = sidebarMenuConfig.filter(
        (item) => !item.permission || hasPermission(item.permission)
    )

    return (
        <nav
            className={`transition-all duration-300 ease-in-out w-full list-none h-full`}
        >
            <ul>
                {menuItems.map((item, index) => {
                    const Icon = item.icon as IconType | undefined
                    const isActive = pathname === item.path
                    const showChatBadge =
                        item.path === PathConfig.CHAT && unreadTotal > 0

                    return (
                        <li key={index}>
                            <Link
                                href={item.path}
                                className={`relative flex gap-3 items-center rounded-4xl p-3 my-1.5 transition-colors duration-200
                                 ${
                                    collapsed
                                        ? 'justify-center'
                                        : 'justify-start'
                                }
                                ${
                                    isActive
                                        ? 'bg-primary/20 hover:bg-primary/10 text-primary font-semibold'
                                        : 'text-secondary hover:bg-[#f5f5f5]'
                                }
                            `}
                            >
                                {Icon && (
                                    <div className='relative flex-shrink-0'>
                                        <Icon
                                            className={`text-3xl ${
                                                isActive ? 'text-primary' : 'text-secondary'
                                            }`}
                                        />
                                        {showChatBadge && (
                                            <span className='absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold'>
                                                {unreadTotal > 99 ? '99+' : unreadTotal}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <AnimatePresence>
                                    {!collapsed && (
                                        <motion.div
                                            className='flex-1'
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                        >
                                            <p className='text-base whitespace-nowrap w-full'>{item.title}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}