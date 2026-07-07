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
import { FaLock, FaLockOpen, FaMagic, FaCheck, FaTimes } from 'react-icons/fa'
import { toast } from 'sonner'
import { workScheduleService } from '@/service/work.schedule.service'
import { scheduleWishService } from '@/service/schedule.wish.service'

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
  const isAdmin = userStore((state) => state.hasPermission('MANAGE_SCHEDULE'))
  const [currentDate, setCurrentDate] = useState(new Date())
  // Дати ("сьогодні", межі тижня) залежать від таймзони: сервер (UTC) і браузер
  // можуть бачити різні дні → рендеримо календар лише на клієнті
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])
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

  const weekDateParam = format(weekStart, 'yyyy-MM-dd')
  const [busyDeptId, setBusyDeptId] = useState<number | null>(null)

  const handleGenerate = useCallback(
    async (departmentId: number) => {
      setBusyDeptId(departmentId)
      try {
        const { data } = await workScheduleService.generateWeek(
          departmentId,
          weekDateParam
        )
        if (data.created === 0) {
          toast.warning('Не вдалося призначити жодної зміни.')
        } else {
          toast.success(`Згенеровано чернетку: ${data.created} змін.`)
        }
        data.warnings.forEach((w) => toast.warning(w.message))
        getWeekView()
      } catch (error: any) {
        toast.error(
          error?.response?.data?.errors?.[0]?.message ??
            error?.response?.data?.message ??
            'Не вдалося згенерувати графік.'
        )
      } finally {
        setBusyDeptId(null)
      }
    },
    [weekDateParam, getWeekView]
  )

  const handlePublish = useCallback(
    async (departmentId: number) => {
      setBusyDeptId(departmentId)
      try {
        await workScheduleService.publishGeneratedWeek(
          departmentId,
          weekDateParam
        )
        toast.success('Графік опубліковано.')
        getWeekView()
      } catch {
        toast.error('Не вдалося опублікувати графік.')
      } finally {
        setBusyDeptId(null)
      }
    },
    [weekDateParam, getWeekView]
  )

  const handleReject = useCallback(
    async (departmentId: number) => {
      setBusyDeptId(departmentId)
      try {
        await workScheduleService.rejectGeneratedWeek(
          departmentId,
          weekDateParam
        )
        toast.success('Чернетку відхилено.')
        getWeekView()
      } catch {
        toast.error('Не вдалося відхилити чернетку.')
      } finally {
        setBusyDeptId(null)
      }
    },
    [weekDateParam, getWeekView]
  )

  // Побажання по вихідних (власні) на поточний тиждень
  const [wishDates, setWishDates] = useState<Set<string>>(new Set())

  const loadWishes = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await scheduleWishService.getMyWishes(
        format(weekStart, 'yyyy-MM-dd'),
        format(weekEnd, 'yyyy-MM-dd')
      )
      setWishDates(
        new Set(data.map((w) => format(new Date(w.date), 'yyyy-MM-dd')))
      )
    } catch {
      // не критично
    }
  }, [user, weekStart, weekEnd])

  useEffect(() => {
    loadWishes()
  }, [loadWishes])

  const toggleWish = useCallback(
    async (day: Date) => {
      const key = format(day, 'yyyy-MM-dd')
      const isWished = wishDates.has(key)
      // Оптимістично оновлюємо
      setWishDates((prev) => {
        const next = new Set(prev)
        if (isWished) next.delete(key)
        else next.add(key)
        return next
      })
      try {
        if (isWished) await scheduleWishService.removeWishByDate(key)
        else await scheduleWishService.addWish(key)
      } catch {
        toast.error('Не вдалося зберегти побажання')
        loadWishes()
      }
    },
    [wishDates, loadWishes]
  )

  if (!isMounted) {
    return (
      <main className='p-8 max-w-full mx-auto'>
        <div className='bg-white rounded-xl shadow-md p-6'>
          <p className='text-center text-gray-500'>Завантаження графіку...</p>
        </div>
      </main>
    )
  }

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

        {/* Побажання по вихідних — доступні кожному співробітнику */}
        <div className='mb-6 rounded-xl border border-gray-100 bg-gray-50/60 p-4'>
          <div className='flex items-center gap-2 mb-3'>
            <span className='text-lg'>🌙</span>
            <span className='text-sm font-semibold text-gray-700'>
              Мої побажання на вихідні
            </span>
            <span className='text-xs text-gray-400'>
              (враховуються при генерації графіка)
            </span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {weekDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const active = wishDates.has(key)
              return (
                <button
                  key={key}
                  onClick={() => toggleWish(day)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    active
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {format(day, 'EE, d', { locale: uk })}
                </button>
              )
            })}
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

                        <div className='flex items-center gap-2'>
                          {isAdmin &&
                            (department.users.some((emp) =>
                              emp.schedule.some((s) => s?.isDraft)
                            ) ? (
                              <>
                                <span className='text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 uppercase'>
                                  Чернетка
                                </span>
                                <button
                                  onClick={() =>
                                    handlePublish(department.departmentId)
                                  }
                                  disabled={busyDeptId === department.departmentId}
                                  className='flex items-center gap-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg px-3 py-1.5 disabled:opacity-40'
                                  title='Опублікувати згенерований графік'
                                >
                                  <FaCheck size={11} /> Прийняти
                                </button>
                                <button
                                  onClick={() =>
                                    handleReject(department.departmentId)
                                  }
                                  disabled={busyDeptId === department.departmentId}
                                  className='flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 disabled:opacity-40'
                                  title='Відхилити чернетку'
                                >
                                  <FaTimes size={11} /> Відхилити
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() =>
                                  handleGenerate(department.departmentId)
                                }
                                disabled={busyDeptId === department.departmentId}
                                className='flex items-center gap-1.5 text-xs font-medium text-white bg-primary hover:opacity-90 rounded-lg px-3 py-1.5 disabled:opacity-40'
                                title='Автоматично згенерувати графік на тиждень'
                              >
                                <FaMagic size={11} />
                                {busyDeptId === department.departmentId
                                  ? 'Генерація...'
                                  : 'Згенерувати'}
                              </button>
                            ))}

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
                      </div>
                    </td>
                  </tr>

                  {isAdmin && department.coverage && (
                    <tr className='bg-white'>
                      <td className='text-left py-1.5 pl-4 text-[11px] uppercase tracking-wide text-gray-400 font-semibold border-b border-gray-100'>
                        Покриття
                      </td>
                      {department.coverage.map((cov, i) => {
                        const hasTarget = cov.required > 0
                        const understaffed = cov.assigned < cov.required
                        return (
                          <td
                            key={`cov-${department.departmentId}-${i}`}
                            className='py-1.5 border-b border-gray-100 text-center'
                          >
                            {hasTarget ? (
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  understaffed
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-emerald-50 text-emerald-600'
                                }`}
                                title={
                                  understaffed
                                    ? 'Недокомплект на цей день'
                                    : 'Штат укомплектовано'
                                }
                              >
                                {cov.assigned}/{cov.required}
                              </span>
                            ) : (
                              <span className='text-[11px] text-gray-300'>—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )}

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
                                  className={`mx-auto w-full max-w-[120px] rounded-lg border-l-4 px-2 py-2 ${shiftPalette(schedule.startedAt)} ${
                                    schedule.isDraft
                                      ? 'border-dashed ring-1 ring-amber-300 opacity-90'
                                      : ''
                                  } ${
                                    schedule.wishViolated
                                      ? 'ring-2 ring-red-400'
                                      : ''
                                  }`}
                                  title={
                                    schedule.wishViolated
                                      ? 'Порушено побажання вихідного'
                                      : undefined
                                  }
                                >
                                  <div className='text-xs font-bold whitespace-nowrap'>
                                    {schedule.startedAt}–{schedule.endTime}
                                  </div>
                                  <div className='text-[10px] opacity-70 flex items-center justify-between'>
                                    <span>
                                      {shiftDurationHours(
                                        schedule.startedAt,
                                        schedule.endTime
                                      )}{' '}
                                      год
                                    </span>
                                    {schedule.wishViolated ? (
                                      <span className='text-red-500 font-semibold'>
                                        ⚠️
                                      </span>
                                    ) : (
                                      schedule.isDraft && (
                                        <span className='text-amber-600 font-semibold'>
                                          ✨
                                        </span>
                                      )
                                    )}
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
