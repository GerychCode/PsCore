'use client'
import React, { useState } from 'react'
import Avatar from '@/app/components/user/Avatar'
import { userStore } from '@/store/user.store'
import { FaEdit } from 'react-icons/fa'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import ProfileModal from '@/app/(isAuth)/profile/Profile.Modal'

const Page = () => {
    const user = userStore((state) => state.user)
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <div className='flex flex-col w-full gap-5'>
            <div className='flex h-auto w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 gap-5 justify-between bg-white'>
                <div className='flex items-center gap-5'>
                    <Avatar avatar={user?.avatar} size={8} />
                    <div className='flex items-left gap-3 flex-col justify-center w-full'>
                        <div>
                            <h3 className='font-semibold text-black text-3xl'>
                                {user?.firstName} {user?.lastName}
                            </h3>
                            <p className='text-xl text-secondary'>{user?.email}</p>
                        </div>
                        <p className='text-xl text-primary '>{user?.role}</p>
                    </div>
                </div>
                <FaEdit
                    className='text-secondary text-xl hover:opacity-75 cursor-pointer'
                    onClick={() => setIsModalOpen(true)}
                />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
                <div className='flex flex-col h-auto w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 gap-3 bg-white'>
                    <h4 className='font-semibold text-black text-xl mb-2'>Загальна інформація</h4>
                    <p><span className='font-medium'>День народження:</span>{' '}
                        {user?.dateOfBirth
                            ? format(new Date(user?.dateOfBirth), 'dd MMM yyyy', {
                                locale: uk,
                            })
                            : '-'}
                    </p>
                    <p><span className='font-medium'>Номер телефону:</span> {user?.phone || '-'}</p>
                    <p><span className='font-medium'>Адреса:</span> {user?.address || '-'}</p>
                    <p><span className='font-medium'>Акаунт створено:</span>{' '}
                        {user?.createdAt
                            ? format(new Date(user?.createdAt), 'dd MMM yyyy', { locale: uk })
                            : '-'}
                    </p>
                    <p><span className='font-medium'>Посада:</span> {user?.role ? user?.role : '-'}</p>
                </div>

                <div className='flex flex-col h-auto w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 gap-3 bg-white'>
                    <h4 className='font-semibold text-black text-xl mb-2'>Статистика</h4>
                    <p className='text-secondary'>Незабаром тут з'явиться статистика.</p>
                </div>
            </div>

            <ProfileModal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
        </div>
    )
}

export default Page