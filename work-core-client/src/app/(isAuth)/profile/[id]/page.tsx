'use client'
import React, { useEffect, useState } from 'react'
import Avatar from '@/app/components/user/Avatar'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { getUserByIdMutation } from '@/hooks/user/get.user.by.id.mutation'
import { userStore } from '@/store/user.store'
import { FaEdit } from 'react-icons/fa'
import ProfileModal from '@/app/(isAuth)/profile/Profile.Modal'
import { useQuery } from '@tanstack/react-query'
import { userService } from '@/service/user.service'

// Імпортуємо розбиті модулі замість одного загального компонента
import {
  StatsKpiCards,
  MonthlyHoursChart,
  RolesDistributionChart,
} from '@/app/components/user/ProfileStatistics'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const userData = userStore((state) => state.user)
  const unwrappedParams = React.use(params)
  const id = parseInt(unwrappedParams.id)
  const isOwner = userData ? userData.id === id : false

  const { mutate, isPending, user } = getUserByIdMutation(id)

  useEffect(() => {
    mutate()
  }, [id])

  const [isModalOpen, setIsModalOpen] = useState(false)

  // Отримуємо статистику
  const { data: statsResponse, isLoading: isStatsLoading } = useQuery({
    queryKey: ['user-stats', id],
    queryFn: () => userService.getUserStatistics(id),
    enabled: !!id,
  })

  const stats = statsResponse?.data

  return (
    <div className='flex flex-col w-full gap-5'>
      {/* 1. ШАПКА: User Info Card */}
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
        {isOwner && (
          <FaEdit
            className='text-secondary text-xl hover:opacity-75 cursor-pointer'
            onClick={() => setIsModalOpen(true)}
          />
        )}
      </div>

      {/* 2. РЯДОК: Загальна інфа + KPI Картки */}
      <div className='grid grid-cols-1 xl:grid-cols-4 gap-5 items-stretch'>
        {/* General Info Card */}
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

        {/* KPI Cards */}
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

      {/* 3. РЯДОК: Графіки */}
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

      {/* Модалка */}
      {isOwner && (
        <ProfileModal
          isModalOpen={isModalOpen}
          setIsModalOpen={setIsModalOpen}
        />
      )}
    </div>
  )
}
