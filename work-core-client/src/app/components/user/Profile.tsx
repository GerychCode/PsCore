// src/app/components/user/Profile.tsx
'use client'

import React from 'react'
import Avatar from '@/app/components/user/Avatar'
import { capitalize } from '@/utils/capitalize'
import { userStore } from '@/store/user.store'
import Link from 'next/link'
import { PathConfig } from '@/config/path.config'
import { FaCrown } from 'react-icons/fa6'
import { useMediaQuery } from '@/hooks/use-media-query'

const Profile = () => {
    const user = userStore((state) => state.user)
    const isAdmin = userStore((state) => state.isAdmin)
    const isMobile = useMediaQuery('(max-width: 768px)')

    return (
        <Link href={PathConfig.PROFILE} className='flex items-center gap-3 '>
            <Avatar avatar={user?.avatar} />
            {!isMobile && (
                <div className='flex flex-col'>
                    <h1 className='text-xl font-semibold text-black flex items-center gap-2'>
                        {capitalize(user?.firstName)} {capitalize(user?.lastName)}
                        {isAdmin && <FaCrown className='text-yellow-500' />}
                    </h1>
                    <p className='text-sm text-secondary'>{user?.email}</p>
                </div>
            )}
        </Link>
    )
}

export default Profile