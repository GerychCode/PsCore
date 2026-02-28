'use client'
import React, { useEffect, useState } from 'react'
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
  addDays,
  subDays,
  isToday,
} from 'date-fns'
import { uk } from 'date-fns/locale'
import { useGetWeekViewMutation } from '@/hooks/work-schedule/get.week-view.mutation'
import { useWeekLockMutation } from '@/hooks/work-schedule/use-week-lock.mutation'
import { useGetUserListMutation } from '@/hooks/user/get.user.list.mutation'
import {
  IWeekView,
  IWorkSchedule,
  IWorkScheduleCreate,
} from '@/interface/IWorkSchedule'
import { userStore } from '@/store/user.store'
import ScheduleModal from '@/app/(isAuth)/schedule/Schedule.Modal'
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi'
import { FaLock, FaLockOpen } from 'react-icons/fa'
import { toast } from 'sonner'

export default function Page() {
  const user = userStore((state) => state.user)
  const isAdmin = userStore((state) => state.isAdmin)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [weekView, setWeekView] = useState<IWeekView[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<
    IWorkSchedule | Partial<IWorkScheduleCreate> | null
  >(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Завантаження списку користувачів для адміна
  const { mutate: fetchUsers, users } = useGetUserListMutation()

  const { mutate: getWeekView, isPending } = useGetWeekViewMutation(
    format(currentDate, 'yyyy-MM-dd'),
    setWeekView
  )

  const { mutate: toggleLock, isPending: isLocking } = useWeekLockMutation(
    () => {
      getWeekView()
    }
  )

  useEffect(() => {
    getWeekView()
    if (isAdmin) {
      fetchUsers()
    }
  }, [currentDate, isAdmin])

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const handleLockClick = (departmentId: number, isLocked: boolean) => {
    if (!isAdmin) return
    toggleLock({
      departmentId,
      date: format(weekStart, 'yyyy-MM-dd'),
      isLocked: !isLocked,
    })
  }

  const handleCellClick = (
    schedule: IWorkSchedule | null,
    userId: number,
    departmentId: number,
    date: Date,
    isLocked: boolean
  ) => {
    const canEdit = isAdmin || (user?.id === userId && !isLocked)

    if (!canEdit) {
      if (isLocked) toast.error('Цей тиждень заблоковано для редагування.')
      return
    }

    if (schedule) {
      setSelectedSchedule(schedule)
    } else {
      setSelectedSchedule({
        userId: userId,
        departmentId,
        date: format(date, 'yyyy-MM-dd'),
        startedAt: '09:00',
        endTime: '18:00',
        isDayOff: false,
      })
    }
    setIsModalOpen(true)
  }

  const handleAddClick = (departmentId: number, isLocked: boolean) => {
    const canEdit = isAdmin || !isLocked

    if (!canEdit) {
      toast.error('Цей тиждень заблоковано для редагування.')
      return
    }

    if (user) {
      const date = weekDays[0]
      setSelectedSchedule({
        userId: user.id, // Адмін зможе змінити це в модалці
        departmentId,
        date: format(date, 'yyyy-MM-dd'),
        startedAt: '09:00',
        endTime: '18:00',
        isDayOff: false,
      })
      setIsModalOpen(true)
    }
  }

  const goToPreviousWeek = () => {
    setCurrentDate((prev) => subDays(prev, 7))
  }

  const goToNextWeek = () => {
    setCurrentDate((prev) => addDays(prev, 7))
  }

  return (
    <main className='p-8 max-w-full mx-auto'>
      <div className='bg-white rounded-xl shadow-md p-6 overflow-x-auto'>
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-xl font-semibold text-gray-700'>
            {format(weekStart, 'd MMMM', { locale: uk })} -{' '}
            {format(weekEnd, 'd MMMM yyyy', { locale: uk })}
          </h2>
          <div className='flex gap-2'>
            <button
              onClick={goToPreviousWeek}
              className='flex items-center justify-center h-10 w-10 border border-gray-300 rounded-full hover:bg-gray-100 transition'
            >
              <FiChevronLeft className='text-gray-600' />
            </button>
            <button
              onClick={goToNextWeek}
              className='flex items-center justify-center h-10 w-10 border border-gray-300 rounded-full hover:bg-gray-100 transition'
            >
              <FiChevronRight className='text-gray-600' />
            </button>
          </div>
        </div>

        {isPending ? (
          <p className='text-center text-gray-500'>Завантаження графіку...</p>
        ) : (
          <table className='w-full text-center border-collapse'>
            <thead>
              <tr>
                <th className='w-[15%] text-left p-4 text-sm font-semibold text-secondary uppercase border-b border-gray-200'>
                  Співробітник
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={`p-4 text-sm font-semibold uppercase border-b border-gray-200 ${
                      isToday(day)
                        ? 'text-primary bg-primary/10'
                        : 'text-secondary'
                    }`}
                  >
                    {format(day, 'E', { locale: uk }).slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekView.map((department) => (
                <React.Fragment key={department.departmentId}>
                  <tr className='bg-gray-50'>
                    <td
                      colSpan={8}
                      className='text-left p-3 pl-4 font-bold text-base text-gray-700 border-l-4 border-primary'
                    >
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                          {department.departmentName}
                          <button
                            onClick={() =>
                              handleLockClick(
                                department.departmentId,
                                department.isLocked
                              )
                            }
                            className={`transition ${isAdmin ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
                            disabled={!isAdmin || isLocking}
                          >
                            {department.isLocked ? (
                              <FaLock
                                className='text-gray-600 text-sm'
                                title='Тиждень заблоковано'
                              />
                            ) : (
                              isAdmin && (
                                <FaLockOpen
                                  className='text-gray-400 text-sm'
                                  title='Тиждень відкрито'
                                />
                              )
                            )}
                          </button>
                        </div>

                        {(isAdmin || !department.isLocked) && (
                          <button
                            onClick={() =>
                              handleAddClick(
                                department.departmentId,
                                department.isLocked
                              )
                            }
                            className='p-1.5 rounded-full hover:bg-gray-200 transition'
                          >
                            <FiPlus className='text-primary' />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {department.users.map((employee) => (
                    <tr key={employee.userId} className='hover:bg-gray-50'>
                      <td className='text-left p-4 font-semibold text-gray-800 border-b border-gray-200'>
                        {employee.firstName} {employee.lastName}
                      </td>
                      {weekDays.map((day, dayIndex) => {
                        const schedule = employee.schedule[dayIndex]
                        const canEditCell =
                          isAdmin ||
                          (user?.id === employee.userId && !department.isLocked)

                        return (
                          <td
                            key={day.toISOString()}
                            className={`p-4 font-semibold border-b border-gray-200 transition-colors ${
                              isToday(day) ? 'bg-primary/5' : ''
                            } ${
                              canEditCell
                                ? 'cursor-pointer hover:bg-primary/10 rounded-md'
                                : 'cursor-not-allowed opacity-70'
                            } ${
                              schedule?.isDayOff
                                ? 'text-gray-400 font-normal'
                                : 'text-gray-800'
                            }`}
                            onClick={() =>
                              handleCellClick(
                                schedule,
                                employee.userId,
                                department.departmentId,
                                day,
                                department.isLocked
                              )
                            }
                          >
                            {schedule ? (
                              schedule.isDayOff ? (
                                'Вихідний'
                              ) : (
                                `${schedule.startedAt} - ${schedule.endTime}`
                              )
                            ) : (
                              <span className='text-gray-400'>-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedSchedule && isModalOpen && (
        <ScheduleModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedSchedule(null)
          }}
          schedule={selectedSchedule}
          onUpdate={() => getWeekView()}
          users={users || []}
        />
      )}
    </main>
  )
}
