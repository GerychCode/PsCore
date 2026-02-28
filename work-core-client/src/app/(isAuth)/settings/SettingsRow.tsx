'use client'

import React, { ReactNode } from 'react'
import { IconType } from 'react-icons'
import { FiChevronRight } from 'react-icons/fi'

interface SettingsRowProps {
    icon: IconType
    title: string
    children: ReactNode // Для опису або статусу
    onClick?: () => void
    isClickable?: boolean
}

const SettingsRow: React.FC<SettingsRowProps> = ({
                                                     icon: Icon,
                                                     title,
                                                     children,
                                                     onClick,
                                                     isClickable = true,
                                                 }) => {
    const Tag = isClickable ? 'button' : 'div'

    return (
        <Tag
            onClick={onClick}
            className={`w-full flex items-center justify-between text-left p-4 border-b border-gray-200 last:border-b-0 ${
                isClickable
                    ? 'cursor-pointer hover:bg-gray-50 transition-colors'
                    : ''
            }`}
            disabled={!isClickable}
        >
            <div className='flex items-center gap-4'>
                <Icon className='text-2xl text-secondary' />
                <div className='flex flex-col'>
                    <h3 className='text-base font-medium text-gray-800'>{title}</h3>
                    <div className='text-sm text-secondary'>{children}</div>
                </div>
            </div>
            {isClickable && <FiChevronRight className='text-xl text-secondary' />}
        </Tag>
    )
}

export default SettingsRow