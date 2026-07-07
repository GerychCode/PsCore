'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useGetShiftListMutation } from '@/hooks/shift/get.shift.list.mutation'
import { format, parseISO } from 'date-fns'
import { uk } from 'date-fns/locale'
import { IShift } from '@/interface/IShift'
import { IoMdAdd, IoMdDocument } from 'react-icons/io'
import { FaCheck, FaCircle, FaFilter, FaTimes, FaTrash } from 'react-icons/fa'
import { userStore } from '@/store/user.store'
import ShiftModal from './Shift.Modal'
import TagModal from './Tag.Modal'
import ReportModal from './Report.Modal'
import { useGetDepartmentListMutation } from '@/hooks/department/use-get-department-list.mutation'
import { useGetUserListMutation } from '@/hooks/user/get.user.list.mutation'
import Avatar from '@/app/components/user/Avatar'
import { useDeleteShiftMutation } from '@/hooks/shift/use-shifts.mutations'
import { useGetTagsQuery } from '@/hooks/shift.tag/get.tags.query'
import {
  StatCard,
  AreaTrendCard,
  DonutCard,
  MiniBarCard,
  ACCENT,
} from './Dashboard.Widgets'

const severityColorMap: Record<number, string> = {
  1: 'text-emerald-400',
  2: 'text-amber-400',
  3: 'text-red-400',
}

const statusPill: Record<string, string> = {
  APPROVED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  PENDING: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  REJECTED: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const months = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
]
const years = [2022, 2023, 2024, 2025, 2026]

const selectCls =
  'h-9 px-3 rounded-lg bg-[#181a20] border border-white/[0.08] text-sm text-white/80 focus:outline-none focus:border-orange-500/50 cursor-pointer'

const ShiftPage = () => {
  // «Адмінські» дії дашборду = право керувати всіма змінами
  const isAdmin = userStore((state) => state.hasPermission('APPROVE_SHIFTS'))

  const { mutate: fetchShifts, shift: shifts } = useGetShiftListMutation()
  const { mutate: fetchDepartments, departments } =
    useGetDepartmentListMutation()
  const { mutate: fetchUsers, users } = useGetUserListMutation()
  const { data: allTags } = useGetTagsQuery()

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedTagId, setSelectedTagId] = useState<string>('')

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<IShift | null>(null)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  const prevShiftsRef = useRef<IShift[]>([])
  const [highlightedIds, setHighlightedIds] = useState<number[]>([])

  const { mutate: deleteShift } = useDeleteShiftMutation(fetchShifts)

  useEffect(() => {
    if (shifts) {
      const prevShifts = prevShiftsRef.current
      if (prevShifts.length > 0) {
        const newIds = shifts
          .filter((s) => !prevShifts.some((ps) => ps.id === s.id))
          .map((s) => s.id)
        const updatedIds = shifts
          .filter((s) => {
            const prev = prevShifts.find((ps) => ps.id === s.id)
            return prev && prev.updatedAt !== s.updatedAt
          })
          .map((s) => s.id)
        const toHighlight = [...newIds, ...updatedIds]
        if (toHighlight.length > 0) {
          setHighlightedIds((prev) => [...new Set([...prev, ...toHighlight])])
          setTimeout(() => {
            setHighlightedIds((prev) =>
              prev.filter((id) => !toHighlight.includes(id))
            )
          }, 1500)
        }
      }
      prevShiftsRef.current = shifts
    }
  }, [shifts])

  useEffect(() => {
    const handleInvalidate = () => fetchShifts()
    window.addEventListener('invalidate_shifts', handleInvalidate)
    return () => window.removeEventListener('invalidate_shifts', handleInvalidate)
  }, [fetchShifts])

  useEffect(() => {
    fetchShifts()
    fetchDepartments()
    if (isAdmin) fetchUsers()
  }, [isAdmin])

  const matchesFilters = (s: IShift) => {
    const isDeptMatch = selectedDepartmentId
      ? s.departmentId === Number(selectedDepartmentId)
      : true
    const isUserMatch =
      isAdmin && selectedUserId ? s.userId === Number(selectedUserId) : true
    const isTagMatch = selectedTagId
      ? s.tags.some((t) => t.id === Number(selectedTagId))
      : true
    return isDeptMatch && isUserMatch && isTagMatch
  }

  const visibleShifts = useMemo(
    () =>
      shifts?.filter((s) => {
        const date = parseISO(s.date)
        return (
          date.getFullYear() === selectedYear &&
          date.getMonth() === selectedMonth &&
          matchesFilters(s)
        )
      }) || [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shifts, selectedYear, selectedMonth, selectedDepartmentId, selectedUserId, selectedTagId, isAdmin]
  )

  // Метрики за довільний місяць (для дельт «місяць до місяця»)
  const metricsFor = (month: number, year: number) => {
    const list =
      shifts?.filter((s) => {
        const d = parseISO(s.date)
        return d.getFullYear() === year && d.getMonth() === month && matchesFilters(s)
      }) || []
    return {
      hours: list.reduce((a, s) => a + (s.totalHours || 0), 0),
      count: list.length,
      approved: list.filter((s) => s.status === 'APPROVED').length,
      pending: list.filter((s) => s.status === 'PENDING').length,
    }
  }

  const cur = useMemo(
    () => metricsFor(selectedMonth, selectedYear),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleShifts]
  )
  const prev = useMemo(() => {
    const pm = selectedMonth === 0 ? 11 : selectedMonth - 1
    const py = selectedMonth === 0 ? selectedYear - 1 : selectedYear
    return metricsFor(pm, py)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleShifts])

  const delta = (c: number, p: number) => {
    if (p === 0) return c > 0 ? { value: 'нове', positive: true } : undefined
    const pct = Math.round(((c - p) / p) * 100)
    return { value: `${Math.abs(pct)}%`, positive: pct >= 0 }
  }

  // Дані по днях місяця
  const perDay = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const arr = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      hours: 0,
      count: 0,
      approved: 0,
      pending: 0,
    }))
    visibleShifts.forEach((s) => {
      const day = parseISO(s.date).getDate()
      const slot = arr[day - 1]
      if (!slot) return
      slot.hours += s.totalHours || 0
      slot.count += 1
      if (s.status === 'APPROVED') slot.approved += 1
      if (s.status === 'PENDING') slot.pending += 1
    })
    return arr
  }, [visibleShifts, selectedMonth, selectedYear])

  const spark = (key: 'hours' | 'count' | 'approved' | 'pending') => {
    const s = perDay.map((d) => ({ v: Number(d[key].toFixed(1)) }))
    return s.length > 1 ? s : [{ v: 0 }, { v: 0 }]
  }

  const dailyArea = perDay.map((d) => ({
    label: String(d.day),
    hours: Number(d.hours.toFixed(1)),
  }))

  const totalHours = cur.hours
  const approvedCount = cur.approved
  const pendingCount = cur.pending
  const rejectedCount = visibleShifts.filter((s) => s.status === 'REJECTED').length

  const statusData = [
    { name: 'Підтверджено', value: approvedCount, color: '#22c55e' },
    { name: 'На розгляді', value: pendingCount, color: ACCENT },
    { name: 'Відхилено', value: rejectedCount, color: '#ef4444' },
  ]

  const deptData = useMemo(() => {
    const map = new Map<string, number>()
    visibleShifts.forEach((s) => {
      const name = s.department?.name || '—'
      map.set(name, (map.get(name) || 0) + (s.totalHours || 0))
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [visibleShifts])

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
    <div className='w-full min-h-full rounded-2xl bg-[#0f1013] text-white p-5 sm:p-6 flex flex-col gap-6'>
      {/* Шапка */}
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <p className='text-orange-500 text-xs font-semibold uppercase tracking-wider'>
            Панель · {months[selectedMonth]} {selectedYear}
          </p>
          <h1 className='text-2xl sm:text-3xl font-bold text-white mt-1'>
            Огляд робочих змін
          </h1>
          <p className='text-white/40 text-sm mt-1'>
            Аналітика годин, змін і статусів за обраний період.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className={selectCls}
          >
            {months.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={selectCls}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {isAdmin && (
            <button
              onClick={() => setIsReportModalOpen(true)}
              className='h-9 px-3.5 flex items-center gap-2 rounded-lg border border-white/[0.1] text-white/80 text-sm font-medium hover:bg-white/[0.04] transition'
            >
              <IoMdDocument className='text-base' />
              <span className='hidden sm:inline'>Звіт</span>
            </button>
          )}
          <button
            onClick={handleOpenCreate}
            className='h-9 px-4 flex items-center gap-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition'
          >
            <IoMdAdd className='text-base' /> Додати
          </button>
        </div>
      </div>

      {/* Додаткові фільтри */}
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-white/30 text-xs flex items-center gap-1.5 pr-1'>
          <FaFilter size={11} /> Фільтри:
        </span>
        <select
          value={selectedDepartmentId}
          onChange={(e) => setSelectedDepartmentId(e.target.value)}
          className={selectCls}
        >
          <option value=''>Всі відділення</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={selectedTagId}
          onChange={(e) => setSelectedTagId(e.target.value)}
          className={selectCls}
        >
          <option value=''>Всі мітки</option>
          {allTags?.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {isAdmin && (
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className={selectCls}
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

      {/* KPI-рядок */}
      <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
        <StatCard
          label='Відпрацьовано годин'
          value={totalHours.toFixed(1)}
          sub='за обраний місяць'
          delta={delta(cur.hours, prev.hours)}
          spark={spark('hours')}
        />
        <StatCard
          label='Кількість змін'
          value={visibleShifts.length}
          sub='усього записів'
          delta={delta(cur.count, prev.count)}
          spark={spark('count')}
          color='#fb923c'
        />
        <StatCard
          label='Підтверджено'
          value={approvedCount}
          sub={`${visibleShifts.length ? Math.round((approvedCount / visibleShifts.length) * 100) : 0}% від усіх`}
          delta={delta(cur.approved, prev.approved)}
          spark={spark('approved')}
          color='#22c55e'
        />
        <StatCard
          label='На розгляді'
          value={pendingCount}
          sub='очікують рішення'
          delta={delta(cur.pending, prev.pending)}
          spark={spark('pending')}
          color='#fbbf24'
        />
      </div>

      {/* Чарти */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
        <div className='lg:col-span-2'>
          <AreaTrendCard title='Години по днях місяця' data={dailyArea} />
        </div>
        <DonutCard
          title='Розподіл за статусами'
          total={visibleShifts.length}
          totalLabel='Змін'
          data={statusData}
        />
      </div>

      {deptData.length > 0 && (
        <MiniBarCard title='Години по відділеннях' data={deptData} />
      )}

      {/* Таблиця останніх записів */}
      <div className='rounded-2xl border border-white/[0.06] bg-[#181a20] overflow-hidden'>
        <div className='px-5 py-4 border-b border-white/[0.06] flex items-center justify-between'>
          <h3 className='text-white font-semibold'>Записи змін</h3>
          <span className='text-white/40 text-xs'>
            {visibleShifts.length} записів · {totalHours.toFixed(1)} год
          </span>
        </div>

        <div
          className={`hidden md:grid ${isAdmin ? 'grid-cols-[90px_1.4fr_1.2fr_1fr_60px_90px_90px]' : 'grid-cols-[90px_1.4fr_1fr_70px_100px]'} gap-3 px-5 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider border-b border-white/[0.04]`}
        >
          <div>Дата</div>
          {isAdmin && <div>Співробітник</div>}
          <div>Час / мітки</div>
          <div>Відділ</div>
          <div className='text-center'>Год</div>
          <div className='text-center'>Статус</div>
          {isAdmin && <div className='text-right'>Дії</div>}
        </div>

        <div className='divide-y divide-white/[0.04] max-h-[52vh] overflow-y-auto custom-scrollbar'>
          {visibleShifts.length === 0 ? (
            <div className='py-14 flex flex-col items-center justify-center text-white/25'>
              <FaFilter className='text-3xl mb-3' />
              <p className='text-sm'>Записів не знайдено</p>
            </div>
          ) : (
            visibleShifts.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenEdit(item)}
                className={`md:grid md:items-center ${isAdmin ? 'md:grid-cols-[90px_1.4fr_1.2fr_1fr_60px_90px_90px]' : 'md:grid-cols-[90px_1.4fr_1fr_70px_100px]'} gap-3 px-5 py-4 text-sm cursor-pointer transition-colors ${
                  highlightedIds.includes(item.id)
                    ? 'bg-orange-500/10'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className='text-white/60 font-medium'>
                  {format(parseISO(item.date), 'dd MMM', { locale: uk })}
                </div>

                {isAdmin && (
                  <div className='flex items-center gap-2.5 mt-2 md:mt-0'>
                    <Avatar avatar={item.user?.avatar} size={2} />
                    <span className='text-white/85 truncate'>
                      {item.user?.firstName} {item.user?.lastName}
                    </span>
                  </div>
                )}

                <div className='flex flex-col gap-1 mt-2 md:mt-0'>
                  <span className='text-white/85 font-medium'>
                    {item.startedAt} – {item.endTime}
                  </span>
                  <div className='flex flex-wrap gap-1.5'>
                    {item.tags?.map((tag) => (
                      <div key={tag.id} className='relative group'>
                        <FaCircle
                          className={`${severityColorMap[tag.severity] || 'text-white/30'} text-[9px]`}
                        />
                        <span className='absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] text-white bg-black/90 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none'>
                          {tag.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='text-white/45 truncate mt-2 md:mt-0'>
                  {item.department?.name || '—'}
                </div>

                <div className='text-center font-semibold text-white/85 mt-2 md:mt-0'>
                  {item.totalHours?.toFixed(1)}
                </div>

                <div className='flex md:justify-center mt-2 md:mt-0'>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${statusPill[item.status] || 'text-white/50 border-white/10'}`}
                  >
                    {item.status === 'APPROVED'
                      ? 'OK'
                      : item.status === 'REJECTED'
                        ? 'Відхил.'
                        : 'Розгляд'}
                  </span>
                </div>

                {isAdmin && (
                  <div className='flex items-center md:justify-end gap-2 mt-3 md:mt-0'>
                    {item.status === 'PENDING' ? (
                      <>
                        <button
                          onClick={(e) => handleStatusChange(e, item.id, 'APPROVED')}
                          className='w-8 h-8 flex items-center justify-center text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/20 rounded-lg transition'
                        >
                          <FaCheck size={11} />
                        </button>
                        <button
                          onClick={(e) => handleStatusChange(e, item.id, 'REJECTED')}
                          className='w-8 h-8 flex items-center justify-center text-red-400 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 rounded-lg transition'
                        >
                          <FaTimes size={11} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        className='w-8 h-8 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition'
                      >
                        <FaTrash size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
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
          availableTags={allTags || []}
          onManageTags={() => setIsTagModalOpen(true)}
        />
      )}
      {isTagModalOpen && (
        <TagModal isOpen={isTagModalOpen} onClose={() => setIsTagModalOpen(false)} />
      )}
      {isReportModalOpen && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          shifts={shifts || []}
          departments={departments || []}
          users={users || []}
          defaultMonth={selectedMonth}
          defaultYear={selectedYear}
          defaultUserId={selectedUserId || undefined}
        />
      )}
    </div>
  )
}

export default ShiftPage
