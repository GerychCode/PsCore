'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { SidebarLogo } from './SidebarLogo'
import { SidebarMenu } from './SidebarMenu'
import { LogoutButton } from '@/app/components/Logout.button'
import { BottomNavBar } from './BottomNavBar'
import { useMediaQuery } from '@/hooks/use-media-query'

interface SidebarProps {
  collapsed: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (isMobile) {
    return <BottomNavBar />
  }

  return (
      <motion.section
          className='bg-white h-full w-full border-1 border-secondary/10 shadow-sm py-10 flex flex-col gap-5 z-1 items-center p-3 justify-between'
          animate={{ maxWidth: collapsed ? 70 : 240 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <SidebarLogo collapsed={collapsed} />
        <SidebarMenu collapsed={collapsed} />

        <div className='flex flex-row items-center justify-center w-full'>
          <LogoutButton />
        </div>
        <div></div>
      </motion.section>
  )
}