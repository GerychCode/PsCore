'use client'

import { useEffect } from 'react'
import { themeStore } from '@/store/theme.store'

export function ThemeApplier() {
  const theme = themeStore((state) => state.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return null
}
