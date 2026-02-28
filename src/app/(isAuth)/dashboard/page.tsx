'use client'

import React, { useEffect, useState } from 'react'
import { useGetShiftListMutation } from '@/hooks/shift/get.shift.list.mutation'
import { parseISO, format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { IShift, ITag } from '@/interface/IShift'
import { IoMdAdd, IoMdDocument } from 'react-icons/io'
import { FaCheck, FaTimes, FaTrash, FaFilter, FaCircle } from 'react-icons/fa'
import { userStore } from '@/store/user.store'
import ShiftModal from './Shift.Modal'
import { useGetDepartmentListMutation } from '@/hooks/department/use-get-department-list.mutation'
import { useGetUserListMutation } from '@/hooks/user/get.user.list.mutation'
import MyModal from '@/app/components/Modal'
import Avatar from '@/app/components/user/Avatar' // <-- Додано імпорт
import {
  useUpdateShiftMutation,
  useDeleteShiftMutation,
} from '@/hooks/shift/use-shifts.mutations'

const statusColorMap: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-700 border border-green-200',
  PENDING: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  REJECTED: 'bg-red-100 text-red-700 border border-red-200',
}

const severityColorMap: Record<number, string> = {
  1: 'text-green-500',
  2: 'text-yellow-500',
  3: 'text-red-500',
}

const months = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
]
const years = [2022, 2023, 2024, 2025]

const getUniqueTagsFromShifts = (shifts: IShift[] | undefined): ITag[] => {
  if (!shifts) return []
  const map = new Map()
  shifts.forEach((s) => s.tags?.forEach((t) => map.set(t.id, t)))
  return Array.from(map.values())
}

const ShiftPage = () => {
  const isAdmin = userStore((state) => state.isAdmin)

  const { mutate: fetchShifts, shift: shifts } = useGetShiftListMutation()
  const { mutate: fetchDepartments, departments } =
      useGetDepartmentListMutation()
  const { mutate: fetchUsers, users } = useGetUserListMutation()

  const [selectedMonth, setSelectedMonth] = useState<number>(
      new Date().getMonth()
  )
  const [selectedYear, setSelectedYear] = useState<number>(
      new Date().getFullYear()
  )
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedTagId, setSelectedTagId] = useState<string>('')

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<IShift | null>(null)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  const { mutate: deleteShift } = useDeleteShiftMutation(fetchShifts)

  useEffect(() => {
    fetchShifts()
    fetchDepartments()
    if (isAdmin) fetchUsers()
  }, [isAdmin])

  const visibleShifts =
      shifts?.filter((s) => {
        const date = parseISO(s.date)
        const isDateMatch =
            date.getFullYear() === selectedYear && date.getMonth() === selectedMonth
        const isDeptMatch = selectedDepartmentId
            ? s.departmentId === Number(selectedDepartmentId)
            : true
        const isUserMatch =
            isAdmin && selectedUserId ? s.userId === Number(selectedUserId) : true
        const isTagMatch = selectedTagId
            ? s.tags.some((t) => t.id === Number(selectedTagId))
            : true

        return isDateMatch && isDeptMatch && isUserMatch && isTagMatch
      }) || []

  const totalHours = visibleShifts.reduce(
      (sum, item) => sum + (item.totalHours || 0),
      0
  )
  const availableTags = getUniqueTagsFromShifts(shifts)

  const handleOpenCreate = () => {
    setSelectedShift(null)
    setIsShiftModalOpen(true)
  }

  const handleOpenEdit = (shift: IShift) => {
    setSelectedShift(shift)
    setIsShiftModalOpen(true)
  }

  const handleStatusChange = (
      e: React.MouseEvent,
      id: number,
      status: 'APPROVED' | 'REJECTED'
  ) => {
    e.stopPropagation()
    import('@/service/shift.service').then(({ shiftService }) => {
      shiftService.updateShift(id, { status }).then(() => fetchShifts())
    })
  }

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (confirm('Видалити цей запис?')) deleteShift(id)
  }

  return (
      <div className='w-full h-full flex flex-col gap-6'>
        <section className='flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
          <div className='flex flex-wrap gap-3 items-center w-full md:w-auto'>
            <div className='flex gap-2'>
              <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className='h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none'
              >
                {months.map((month, idx) => (
                    <option key={idx} value={idx}>
                      {month}
                    </option>
                ))}
              </select>
              <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className='h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none'
              >
                {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                ))}
              </select>
            </div>

            <div className='h-6 w-[1px] bg-gray-300 mx-1 hidden sm:block'></div>

            <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className='h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none'
            >
              <option value=''>Всі відділення</option>
              {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
              ))}
            </select>

            <select
                value={selectedTagId}
                onChange={(e) => setSelectedTagId(e.target.value)}
                className='h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none'
            >
              <option value=''>Всі мітки</option>
              {availableTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
              ))}
            </select>

            {isAdmin && (
                <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className='h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none'
                >
                  <option value=''>Всі співробітники</option>
                  {users?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                  ))}
                </select>
            )}
          </div>

          <div className='flex gap-3 w-full md:w-auto justify-end'>
            {isAdmin && (
                <button
                    onClick={() => setIsReportModalOpen(true)}
                    className='h-10 px-4 flex items-center gap-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition'
                >
                  <IoMdDocument className='text-lg' />
                  <span className='hidden sm:inline'>Звіт</span>
                </button>
            )}
            <button
                onClick={handleOpenCreate}
                className='h-10 px-4 flex items-center gap-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition shadow-sm'
            >
              <IoMdAdd className='text-lg' />
              Додати
            </button>
          </div>
        </section>

        <div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
          <div className='grid grid-cols-[100px_1fr] px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider'>
            <div>Дата</div>
            <div
                className={`grid ${isAdmin ? 'grid-cols-[1.5fr_1.5fr_1fr_0.5fr_0.8fr_100px]' : 'grid-cols-4'} gap-4 items-center`}
            >
              {isAdmin && <div>Співробітник</div>}
              <div>Час</div>
              <div>Відділ</div>
              <div className='text-center'>Год.</div>
              <div className='text-center'>Статус</div>
              {isAdmin && <div className='text-right'>Дії</div>}
            </div>
          </div>

          <div className='divide-y divide-gray-100'>
            {visibleShifts.length === 0 ? (
                <div className='py-12 flex flex-col items-center justify-center text-gray-400'>
                  <FaFilter className='text-4xl mb-3 opacity-20' />
                  <p>Записів не знайдено</p>
                </div>
            ) : (
                visibleShifts.map((item) => (
                    <div
                        key={item.id}
                        className='grid grid-cols-[100px_1fr] px-6 py-4 text-sm text-gray-800 hover:bg-gray-50 transition-colors cursor-pointer items-start'
                        onClick={() => handleOpenEdit(item)}
                    >
                      <div className='font-medium text-gray-900 pt-1'>
                        {format(parseISO(item.date), 'dd MMM', { locale: uk })}
                      </div>

                      <div
                          className={`grid ${isAdmin ? 'grid-cols-[1.5fr_1.5fr_1fr_0.5fr_0.8fr_100px]' : 'grid-cols-4'} gap-4 items-center`}
                      >
                        {isAdmin && (
                            <div className='flex items-center gap-3 overflow-hidden'>
                              {/* --- ЗАМІНА ТУТ: Використовуємо компонент Avatar для правильного формування URL --- */}
                              <Avatar avatar={item.user?.avatar} size={2} />
                              <div className='flex flex-col truncate'>
                        <span className='font-medium text-gray-900'>
                          {item.user?.firstName}
                        </span>
                                <span className='text-xs text-gray-500'>
                          {item.user?.lastName}
                        </span>
                              </div>
                            </div>
                        )}

                        <div className='flex flex-col gap-1'>
                    <span className='text-gray-900 font-medium text-base'>
                      {item.startedAt} – {item.endTime}
                    </span>

                          <div className='flex flex-wrap gap-2'>
                            {item.tags?.map((tag) => (
                                <div key={tag.id} className='relative group'>
                                  <FaCircle
                                      className={`${severityColorMap[tag.severity] || 'text-gray-400'} text-[10px]`}
                                  />
                                  <span className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none'>
                            {tag.name}
                          </span>
                                </div>
                            ))}
                          </div>
                        </div>

                        <div className='truncate text-gray-500 text-sm'>
                          {item.department?.name || '—'}
                        </div>

                        <div className='font-bold text-center text-gray-800'>
                          {item.totalHours?.toFixed(1)}
                        </div>

                        <div className='flex justify-center'>
                    <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusColorMap[item.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {item.status === 'APPROVED'
                          ? 'OK'
                          : item.status === 'REJECTED'
                              ? 'Відхил.'
                              : 'Розгляд'}
                    </span>
                        </div>

                        {isAdmin && (
                            <div className='flex items-center justify-end gap-2'>
                              {item.status === 'PENDING' ? (
                                  <>
                                    <button
                                        onClick={(e) =>
                                            handleStatusChange(e, item.id, 'APPROVED')
                                        }
                                        className='w-8 h-8 flex items-center justify-center text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition'
                                    >
                                      <FaCheck size={12} />
                                    </button>
                                    <button
                                        onClick={(e) =>
                                            handleStatusChange(e, item.id, 'REJECTED')
                                        }
                                        className='w-8 h-8 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition'
                                    >
                                      <FaTimes size={12} />
                                    </button>
                                  </>
                              ) : (
                                  <button
                                      onClick={(e) => handleDelete(e, item.id)}
                                      className='w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition'
                                  >
                                    <FaTrash size={12} />
                                  </button>
                              )}
                            </div>
                        )}
                      </div>
                    </div>
                ))
            )}
          </div>
        </div>

        <div className='flex justify-end items-center gap-2 mt-2'>
          <span className='text-gray-500 text-sm'>Всього годин:</span>
          <span className='text-primary text-xl font-bold'>
          {totalHours.toFixed(1)}
        </span>
        </div>

        {isShiftModalOpen && (
            <ShiftModal
                isOpen={isShiftModalOpen}
                onClose={() => {
                  setIsShiftModalOpen(false)
                  setSelectedShift(null)
                  fetchShifts()
                }}
                shift={selectedShift}
                departments={departments || []}
                users={users || []}
                availableTags={availableTags}
            />
        )}

        {isReportModalOpen && (
            <MyModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            >
              <div className='p-8 flex flex-col items-center gap-6 text-center max-w-sm mx-auto'>
                <div className='w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center text-2xl'>
                  <IoMdDocument />
                </div>
                <div>
                  <h2 className='text-xl font-bold text-gray-900 mb-2'>
                    Експорт звіту
                  </h2>
                  <p className='text-gray-500 text-sm leading-relaxed'>
                    Тут ви зможете згенерувати PDF або Excel звіт по годинах
                    співробітників за обраний період.
                  </p>
                </div>

                <div className='w-full p-4 bg-gray-50 rounded-xl text-left text-xs space-y-2 border border-gray-100 text-gray-600'>
                  <div className='flex justify-between'>
                    <span>Період:</span>{' '}
                    <span className='font-medium text-gray-900'>
                  {months[selectedMonth]} {selectedYear}
                </span>
                  </div>
                  {selectedDepartmentId && (
                      <div className='flex justify-between'>
                        <span>Відділення:</span>{' '}
                        <span className='font-medium text-gray-900'>
                    {
                      departments?.find(
                          (d) => d.id === Number(selectedDepartmentId)
                      )?.name
                    }
                  </span>
                      </div>
                  )}
                  {isAdmin && selectedUserId && (
                      <div className='flex justify-between'>
                        <span>Співробітник:</span>{' '}
                        <span className='font-medium text-gray-900'>
                    {
                      users?.find((u) => u.id === Number(selectedUserId))
                          ?.firstName
                    }
                  </span>
                      </div>
                  )}
                </div>

                <div className='flex gap-3 w-full'>
                  <button
                      onClick={() => setIsReportModalOpen(false)}
                      className='flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm'
                  >
                    Скасувати
                  </button>
                  <button
                      onClick={() => setIsReportModalOpen(false)}
                      className='flex-1 py-2.5 bg-primary text-white rounded-xl hover:opacity-90 font-medium text-sm shadow-sm'
                  >
                    Завантажити
                  </button>
                </div>
              </div>
            </MyModal>
        )}
      </div>
  )
}

export default ShiftPage