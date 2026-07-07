'use client'

import React, { useMemo, useState } from 'react'
import MyModal from '@/app/components/Modal'
import { IShift } from '@/interface/IShift'
import { IDepartment } from '@/interface/IDepartment'
import { IUser } from '@/interface/IUser'
import {
  exportWorkHoursReport,
  ReportShift,
} from '@/utils/exportWorkHoursReport'
import { FaFileExcel, FaChevronDown, FaChevronUp } from 'react-icons/fa'
import { toast } from 'sonner'

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

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  shifts: IShift[]
  departments: IDepartment[]
  users: IUser[]
  defaultMonth: number
  defaultYear: number
  defaultUserId?: string
}

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  shifts,
  departments,
  users,
  defaultMonth,
  defaultYear,
  defaultUserId,
}) => {
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]

  const [userId, setUserId] = useState<string>(defaultUserId || '')
  const [month, setMonth] = useState<number>(defaultMonth)
  const [year, setYear] = useState<number>(defaultYear)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>(
    departments.map((d) => d.id)
  )
  const [onlyApproved, setOnlyApproved] = useState(true)
  const [roundToHalfHour, setRoundToHalfHour] = useState(false)
  const [customFileName, setCustomFileName] = useState('')

  const selectedUser = useMemo(
    () => users.find((u) => u.id === Number(userId)),
    [users, userId]
  )

  const previewHours = useMemo(() => {
    if (!userId) return 0
    return shifts
      .filter((s) => {
        const date = new Date(s.date)
        return (
          s.userId === Number(userId) &&
          date.getFullYear() === year &&
          date.getMonth() === month &&
          (!onlyApproved || s.status === 'APPROVED')
        )
      })
      .reduce((sum, s) => sum + (s.totalHours || 0), 0)
  }, [shifts, userId, year, month, onlyApproved])

  const toggleDept = (id: number) => {
    setSelectedDeptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleExport = () => {
    if (!selectedUser) {
      toast.error('Оберіть співробітника')
      return
    }

    const reportDepartments = departments.filter((d) =>
      selectedDeptIds.includes(d.id)
    )
    if (reportDepartments.length === 0) {
      toast.error('Оберіть хоча б одне відділення')
      return
    }

    const employeeShifts: ReportShift[] = shifts
      .filter((s) => s.userId === selectedUser.id)
      .map((s) => ({
        date: s.date,
        departmentId: s.departmentId,
        totalHours: s.totalHours,
        status: s.status,
      }))

    exportWorkHoursReport({
      employeeName: `${selectedUser.lastName} ${selectedUser.firstName}`,
      year,
      month: month + 1,
      monthName: months[month],
      departments: reportDepartments,
      shifts: employeeShifts,
      onlyApproved,
      roundToHalfHour,
      fileName: customFileName.trim() || undefined,
    })

    toast.success('Звіт сформовано')
    onClose()
  }

  return (
    <MyModal isOpen={isOpen} onClose={onClose}>
      <div className='flex flex-col gap-5 max-h-[80vh] overflow-y-auto'>
        <div className='flex items-center gap-3'>
          <div className='w-11 h-11 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-xl'>
            <FaFileExcel />
          </div>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>
              Звіт по співробітнику
            </h2>
            <p className='text-sm text-gray-500'>
              Експорт відпрацьованих годин у Excel
            </p>
          </div>
        </div>

        <div className='flex flex-col gap-2'>
          <label className='text-sm font-medium text-gray-700'>
            Співробітник
          </label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className='h-11 px-3 border-2 border-gray-200 rounded-xl bg-white text-sm outline-none focus:border-primary'
          >
            <option value=''>— Оберіть співробітника —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.lastName} {u.firstName}
              </option>
            ))}
          </select>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='flex flex-col gap-2'>
            <label className='text-sm font-medium text-gray-700'>Місяць</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className='h-11 px-3 border-2 border-gray-200 rounded-xl bg-white text-sm outline-none focus:border-primary'
            >
              {months.map((m, idx) => (
                <option key={idx} value={idx}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className='flex flex-col gap-2'>
            <label className='text-sm font-medium text-gray-700'>Рік</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className='h-11 px-3 border-2 border-gray-200 rounded-xl bg-white text-sm outline-none focus:border-primary'
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className='border-2 border-gray-100 rounded-xl overflow-hidden'>
          <button
            type='button'
            onClick={() => setShowAdvanced((v) => !v)}
            className='w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition'
          >
            Розширені налаштування
            {showAdvanced ? (
              <FaChevronUp className='text-gray-400' />
            ) : (
              <FaChevronDown className='text-gray-400' />
            )}
          </button>

          {showAdvanced && (
            <div className='flex flex-col gap-5 px-4 pb-4 pt-1 border-t border-gray-100'>
              <div className='flex flex-col gap-2'>
                <span className='text-sm font-medium text-gray-700'>
                  Відділення у звіті (колонки)
                </span>
                <div className='flex flex-wrap gap-2'>
                  {departments.map((d) => {
                    const active = selectedDeptIds.includes(d.id)
                    return (
                      <button
                        key={d.id}
                        type='button'
                        onClick={() => toggleDept(d.id)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition ${
                          active
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-white border-gray-200 text-gray-500'
                        }`}
                      >
                        {d.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className='flex flex-col gap-2'>
                <span className='text-sm font-medium text-gray-700'>
                  Які зміни враховувати
                </span>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={() => setOnlyApproved(true)}
                    className={`flex-1 py-2 rounded-xl text-sm border transition ${
                      onlyApproved
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    Тільки підтверджені
                  </button>
                  <button
                    type='button'
                    onClick={() => setOnlyApproved(false)}
                    className={`flex-1 py-2 rounded-xl text-sm border transition ${
                      !onlyApproved
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    Усі зміни
                  </button>
                </div>
              </div>

              <label className='flex items-center gap-3 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={roundToHalfHour}
                  onChange={(e) => setRoundToHalfHour(e.target.checked)}
                  className='w-4 h-4 accent-primary'
                />
                <span className='text-sm text-gray-700'>
                  Округлювати години до 0.5
                </span>
              </label>

              <div className='flex flex-col gap-2'>
                <label className='text-sm font-medium text-gray-700'>
                  Назва файлу (необовʼязково)
                </label>
                <input
                  type='text'
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder='Авто: Прізвище_Рік_Місяць'
                  className='h-11 px-3 border-2 border-gray-200 rounded-xl bg-white text-sm outline-none focus:border-primary'
                />
              </div>
            </div>
          )}
        </div>

        {userId && (
          <div className='flex justify-between items-center px-4 py-3 bg-gray-50 rounded-xl text-sm'>
            <span className='text-gray-500'>
              {months[month]} {year} ·{' '}
              {onlyApproved ? 'підтверджені' : 'усі зміни'}
            </span>
            <span className='font-semibold text-gray-900'>
              {previewHours.toFixed(2)} год
            </span>
          </div>
        )}

        <div className='flex gap-3'>
          <button
            type='button'
            onClick={onClose}
            className='flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm'
          >
            Скасувати
          </button>
          <button
            type='button'
            onClick={handleExport}
            disabled={!userId}
            className='flex-1 py-2.5 bg-primary text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-sm flex items-center justify-center gap-2'
          >
            <FaFileExcel /> Завантажити Excel
          </button>
        </div>
      </div>
    </MyModal>
  )
}

export default ReportModal
