'use client'
import React, { useEffect, useState, useMemo, useCallback } from 'react'
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

const shiftDurationHours = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.round((eh * 60 + em - (sh * 60 + sm)) / 6) / 10
}

// Колір блоку залежить від часу початку зміни
const shiftPalette = (start: string) => {
  const hour = parseInt(start, 10)
  if (hour < 12) return 'bg-amber-50 text-amber-700 border-amber-400'
  if (hour < 16) return 'bg-sky-50 text-sky-700 border-sky-400'
  return 'bg-violet-50 text-violet-700 border-violet-400'
}

const legendItems = [
  { label: 'Ранкова', className: 'bg-amber-400' },
  { label: 'Денна', className: 'bg-sky-400' },
  { label: 'Вечірня', className: 'bg-violet-400' },
  { label: 'Вихідний', className: 'bg-gray-300' },
]

export default function Page() {
  const user = userStore((state) => state.user)
  const isAdmin = userStore((state) => state.isAdmin)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [weekView, setWeekView] = useState<IWeekView[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<
    IWorkSchedule | Partial<IWorkScheduleCreate> | null
  >(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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

  const { weekStart, weekEnd, weekDays } = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    const end = endOfWeek(currentDate, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start, end })
    return { weekStart: start, weekEnd: end, weekDays: days }
  }, [currentDate])

  useEffect(() => {
    getWeekView()
    if (isAdmin) {
      fetchUsers()
    }
  }, [currentDate, isAdmin, fetchUsers])

  useEffect(() => {
    const handleInvalidateSchedules = () => {
      getWeekView()
    }

    window.addEventListener('invalidate_schedules', handleInvalidateSchedules)

    return () => {
      window.removeEventListener(
        'invalidate_schedules',
        handleInvalidateSchedules
      )
    }
  }, [getWeekView])

  const handleLockClick = useCallback(
    (departmentId: number, isLocked: boolean) => {
      if (!isAdmin) return
      toggleLock({
        departmentId,
        date: format(weekStart, 'yyyy-MM-dd'),
        isLocked: !isLocked,
      })
    },
    [isAdmin, toggleLock, weekStart]
  )

  const handleCellClick = useCallback(
    (
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
    },
    [isAdmin, user?.id]
  )

  const handleEmptyCellClick = useCallback(
    (departmentId: number, date: Date, isLocked: boolean) => {
      const canEdit = isAdmin || !isLocked

      if (!canEdit) {
        toast.error('Цей тиждень заблоковано для редагування.')
        return
      }

      if (user) {
        setSelectedSchedule({
          userId: user.id,
          departmentId,
          date: format(date, 'yyyy-MM-dd'),
          startedAt: '09:00',
          endTime: '18:00',
          isDayOff: false,
        })
        setIsModalOpen(true)
      }
    },
    [isAdmin, user]
  )

  const handleAddClick = useCallback(
    (departmentId: number, isLocked: boolean) => {
      const canEdit = isAdmin || !isLocked

      if (!canEdit) {
        toast.error('Цей тиждень заблоковано для редагування.')
        return
      }

      if (user) {
        const date = weekDays[0]
        setSelectedSchedule({
          userId: user.id,
          departmentId,
          date: format(date, 'yyyy-MM-dd'),
          startedAt: '09:00',
          endTime: '18:00',
          isDayOff: false,
        })
        setIsModalOpen(true)
      }
    },
    [isAdmin, user, weekDays]
  )

  const goToPreviousWeek = useCallback(() => {
    setCurrentDate((prev) => subDays(prev, 7))
  }, [])

  const goToNextWeek = useCallback(() => {
    setCurrentDate((prev) => addDays(prev, 7))
  }, [])

  return (
    <main className='p-8 max-w-full mx-auto'>
      <div className='bg-white rounded-xl shadow-md p-6 overflow-x-auto'>
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-xl font-semibold text-gray-700'>
            {format(weekStart, 'd MMMM', { locale: uk })} -{' '}
            {format(weekEnd, 'd MMMM yyyy', { locale: uk })}
          </h2>
          <div className='hidden lg:flex items-center gap-4'>
            {legendItems.map((item) => (
              <span
                key={item.label}
                className='flex items-center gap-1.5 text-xs text-gray-500'
              >
                <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
                {item.label}
              </span>
            ))}
          </div>
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
                <th className='w-[15%] text-left p-4 text-sm font-semibold text-secondary uppercase border-b border-gray-200 align-bottom'>
                  Співробітник
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={`p-4 border-b border-gray-200 ${
                      isToday(day) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className='flex flex-col items-center justify-center gap-1'>
                      <span
                        className={`text-xs uppercase font-medium ${isToday(day) ? 'text-primary' : 'text-gray-500'}`}
                      >
                        {format(day, 'E', { locale: uk }).slice(0, 2)}
                      </span>
                      <span
                        className={`text-base font-bold ${
                          isToday(day) ? 'text-primary' : 'text-gray-800'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>
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
                            title='Додати зміну у це відділення'
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
                            className={`p-2 border-b border-gray-200 transition-colors ${
                              isToday(day) ? 'bg-primary/5' : ''
                            } ${
                              canEditCell
                                ? 'cursor-pointer hover:bg-primary/10 rounded-md'
                                : 'cursor-not-allowed opacity-70'
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
                                <div className='mx-auto w-full max-w-[120px] rounded-lg border-l-4 border-gray-300 bg-gray-100 px-2 py-2 text-xs font-medium text-gray-400'>
                                  🌙 Вихідний
                                </div>
                              ) : (
                                <div
                                  className={`mx-auto w-full max-w-[120px] rounded-lg border-l-4 px-2 py-2 ${shiftPalette(schedule.startedAt)}`}
                                >
                                  <div className='text-xs font-bold whitespace-nowrap'>
                                    {schedule.startedAt}–{schedule.endTime}
                                  </div>
                                  <div className='text-[10px] opacity-70'>
                                    {shiftDurationHours(
                                      schedule.startedAt,
                                      schedule.endTime
                                    )}{' '}
                                    год
                                  </div>
                                </div>
                              )
                            ) : (
                              <span className='text-gray-300 font-semibold'>
                                —
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  <tr className='border-b border-gray-200 bg-white hover:bg-gray-50 transition-colors'>
                    <td className='text-left p-4 text-sm text-gray-400 italic font-medium'>
                      <div className='flex items-center gap-2'>
                        <FiPlus className='text-gray-400' /> Додати собі зміну
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const canAdd = isAdmin || !department.isLocked

                      return (
                        <td
                          key={`empty-${department.departmentId}-${day.toISOString()}`}
                          className={`p-4 font-bold text-gray-300 transition-colors ${
                            isToday(day) ? 'bg-primary/5' : ''
                          } ${
                            canAdd
                              ? 'cursor-pointer hover:bg-primary/10 hover:text-primary rounded-md'
                              : 'cursor-not-allowed opacity-50'
                          }`}
                          onClick={() =>
                            handleEmptyCellClick(
                              department.departmentId,
                              day,
                              department.isLocked
                            )
                          }
                          title='Натисни, щоб виставити собі графік на цей день'
                        >
                          -
                        </td>
                      )
                    })}
                  </tr>
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
