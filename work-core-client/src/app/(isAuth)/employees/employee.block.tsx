import React, { useState } from 'react'
import { IUser } from '@/interface/IUser'
import Avatar from '@/app/components/user/Avatar'
import { IEmployeeLevel } from '@/service/employee.level.service'
import { FaCheck, FaPen, FaTimes } from 'react-icons/fa'

interface Props {
  user: IUser
  onClick?: () => void
  level?: IEmployeeLevel
  canEditLevel?: boolean
  onBaseLevelSave?: (userId: number, baseLevel: number) => void
}

const levelBadgeColor = (level: number) => {
  if (level >= 8) return 'bg-violet-100 text-violet-700'
  if (level >= 5) return 'bg-sky-100 text-sky-700'
  if (level >= 3) return 'bg-emerald-100 text-emerald-700'
  return 'bg-gray-100 text-gray-600'
}

const EmployeeBlock = ({
  user,
  onClick,
  level,
  canEditLevel,
  onBaseLevelSave,
}: Props) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draftBaseLevel, setDraftBaseLevel] = useState(user.baseLevel ?? 1)

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
      <div
          onClick={onClick}
          key={user.id}
          className='bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col items-center gap-4 cursor-pointer transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-1'
      >
        <div className='flex flex-col sm:flex-row items-center w-full gap-5 text-center sm:text-left'>
          <div className='flex-shrink-0'>
            <Avatar avatar={user.avatar ? user.avatar : undefined} size={6} />
          </div>
          <div className='flex flex-col justify-center w-full'>
            <h3 className='text-xl font-bold text-gray-800'>
              {user.firstName} {user.lastName}
            </h3>
            <p className='text-md text-gray-500'>{user?.email}</p>
            <div className='flex items-center justify-center sm:justify-start gap-3 mt-1'>
              <p className='text-lg text-blue-600 font-semibold'>{user?.role}</p>

              {level && (
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${levelBadgeColor(level.level)}`}
                  title={`XP: ${level.xp} · Надійність: ${level.reliability}%`}
                >
                  LVL {level.level}
                </span>
              )}

              {canEditLevel && !isEditing && (
                <button
                  onClick={(e) => {
                    stop(e)
                    setDraftBaseLevel(user.baseLevel ?? 1)
                    setIsEditing(true)
                  }}
                  className='text-gray-300 hover:text-primary transition-colors'
                  title='Змінити базовий рівень'
                >
                  <FaPen size={12} />
                </button>
              )}

              {canEditLevel && isEditing && (
                <span
                  className='flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5'
                  onClick={stop}
                >
                  <span className='text-[10px] text-gray-400 uppercase font-semibold'>
                    база
                  </span>
                  <select
                    value={draftBaseLevel}
                    onChange={(e) => setDraftBaseLevel(Number(e.target.value))}
                    className='text-sm font-bold bg-transparent focus:outline-none cursor-pointer'
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={(e) => {
                      stop(e)
                      onBaseLevelSave?.(user.id, draftBaseLevel)
                      setIsEditing(false)
                    }}
                    className='text-emerald-500 hover:opacity-75'
                    title='Зберегти'
                  >
                    <FaCheck size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      stop(e)
                      setIsEditing(false)
                    }}
                    className='text-gray-400 hover:text-red-500'
                    title='Скасувати'
                  >
                    <FaTimes size={12} />
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}

export default EmployeeBlock
