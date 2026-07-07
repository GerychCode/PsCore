'use client'
import React, { useState } from 'react'
import Avatar from '@/app/components/user/Avatar'
import { userStore } from '@/store/user.store'
import { FaEdit } from 'react-icons/fa'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import ProfileModal from '@/app/(isAuth)/profile/Profile.Modal'
import { useQuery } from '@tanstack/react-query'
import { userService } from '@/service/user.service'

import {
  StatsKpiCards,
  MonthlyHoursChart,
  RolesDistributionChart,
} from '@/app/components/user/ProfileStatistics'

const Page = () => {
  const user = userStore((state) => state.user)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: statsResponse, isLoading: isStatsLoading } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: () => userService.getUserStatistics(user!.id),
    enabled: !!user?.id,
  })

  const stats = statsResponse?.data

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

      <div className='grid grid-cols-1 xl:grid-cols-4 gap-5 items-stretch'>
        <div className='flex flex-col h-full w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 gap-3 bg-white xl:col-span-1'>
          <h4 className='font-semibold text-black text-xl mb-2'>
            Загальна інформація
          </h4>
          <p>
            <span className='font-medium'>День народження:</span>{' '}
            {user?.dateOfBirth
              ? format(new Date(user?.dateOfBirth), 'dd MMM yyyy', {
                  locale: uk,
                })
              : '-'}
          </p>
          <p>
            <span className='font-medium'>Номер телефону:</span>{' '}
            {user?.phone || '-'}
          </p>
          <p>
            <span className='font-medium'>Адреса:</span> {user?.address || '-'}
          </p>
          <p>
            <span className='font-medium'>Акаунт створено:</span>{' '}
            {user?.createdAt
              ? format(new Date(user?.createdAt), 'dd MMM yyyy', { locale: uk })
              : '-'}
          </p>
          <p>
            <span className='font-medium'>Посада:</span>{' '}
            {user?.role ? user?.role : '-'}
          </p>
        </div>

        <div className='xl:col-span-3 h-full'>
          {isStatsLoading ? (
            <div className='flex h-full w-full items-center justify-center rounded-2xl shadow-xs border-1 border-secondary/10 p-6 bg-white'>
              <p className='text-secondary'>Завантаження статистики...</p>
            </div>
          ) : stats ? (
            <StatsKpiCards
              totalHours={stats.totalHours}
              totalShifts={stats.totalShifts}
              overtimeHours={stats.overtimeHours}
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center rounded-2xl shadow-xs border-1 border-secondary/10 p-6 bg-white'>
              <p className='text-secondary'>Статистика поки відсутня.</p>
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div className='grid grid-cols-1 xl:grid-cols-4 gap-5 items-stretch'>
          <div className='xl:col-span-3 h-full'>
            <MonthlyHoursChart data={stats.dailyHours} />
          </div>
          <div className='xl:col-span-1 h-full'>
            <RolesDistributionChart data={stats.tagDistribution} />
          </div>
        </div>
      )}

      <ProfileModal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
    </div>
  )
}

export default Page
