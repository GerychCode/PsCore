'use client'

import React from 'react'
import { FaMoon, FaSun } from 'react-icons/fa'
import { themeStore } from '@/store/theme.store'

const ThemeToggle: React.FC = () => {
  const theme = themeStore((state) => state.theme)
  const toggleTheme = themeStore((state) => state.toggleTheme)
  const isDark = theme === 'dark'

  return (
    <div className='w-full flex items-center justify-between p-4 border-b border-gray-200 last:border-b-0'>
      <div className='flex items-center gap-4'>
        <div className='text-2xl text-secondary'>
          {isDark ? <FaMoon /> : <FaSun />}
        </div>
        <div className='flex flex-col'>
          <h3 className='text-base font-medium text-gray-800'>Темна тема</h3>
          <p className='text-sm text-secondary'>
            {isDark
              ? 'Темне оформлення увімкнено'
              : 'Світле оформлення увімкнено'}
          </p>
        </div>
      </div>

      <button
        type='button'
        role='switch'
        aria-checked={isDark}
        onClick={toggleTheme}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${
          isDark ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${
            isDark ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export default ThemeToggle
