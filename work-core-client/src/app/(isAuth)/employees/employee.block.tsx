import React, { useState } from 'react'
import { IUser, IAppRole } from '@/interface/IUser'
import Avatar from '@/app/components/user/Avatar'
import { IEmployeeLevel } from '@/service/employee.level.service'
import { rolesService } from '@/service/roles.service'
import { toast } from 'sonner'
import { FaCheck, FaPen, FaTimes, FaUserShield } from 'react-icons/fa'

interface Props {
  user: IUser
  onClick?: () => void
  level?: IEmployeeLevel
  canEditLevel?: boolean
  onBaseLevelSave?: (userId: number, baseLevel: number) => void
  canManageRoles?: boolean
  allRoles?: IAppRole[]
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
  canManageRoles,
  allRoles = [],
}: Props) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draftBaseLevel, setDraftBaseLevel] = useState(user.baseLevel ?? 1)

  const [rolesOpen, setRolesOpen] = useState(false)
  const [roleIds, setRoleIds] = useState<Set<number>>(new Set())
  const [rolesLoaded, setRolesLoaded] = useState(false)
  const [savingRoles, setSavingRoles] = useState(false)

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  const openRoles = async (e: React.MouseEvent) => {
    stop(e)
    setRolesOpen((v) => !v)
    if (!rolesLoaded) {
      try {
        const { data } = await rolesService.getUserRoles(user.id)
        setRoleIds(new Set(data.map((r) => r.id)))
        setRolesLoaded(true)
      } catch {
        toast.error('Не вдалося завантажити ролі користувача')
      }
    }
  }

  const toggleRole = (id: number) =>
    setRoleIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const saveRoles = async (e: React.MouseEvent) => {
    stop(e)
    setSavingRoles(true)
    try {
      await rolesService.setUserRoles(user.id, [...roleIds])
      toast.success('Ролі оновлено')
      setRolesOpen(false)
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Не вдалося зберегти ролі')
    } finally {
      setSavingRoles(false)
    }
  }

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

              {canManageRoles && (
                <button
                  onClick={openRoles}
                  className='text-gray-300 hover:text-primary transition-colors'
                  title='Керувати ролями'
                >
                  <FaUserShield size={13} />
                </button>
              )}
            </div>

            {canManageRoles && rolesOpen && (
              <div
                className='mt-3 w-full bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2'
                onClick={stop}
              >
                <span className='text-xs font-semibold text-gray-500 uppercase'>
                  Ролі
                </span>
                <div className='flex flex-col gap-1 max-h-40 overflow-y-auto'>
                  {allRoles.map((role) => (
                    <label
                      key={role.id}
                      className='flex items-center gap-2 text-sm cursor-pointer'
                    >
                      <input
                        type='checkbox'
                        checked={roleIds.has(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className='h-4 w-4 accent-primary'
                      />
                      <span
                        className='h-2.5 w-2.5 rounded-full'
                        style={{ backgroundColor: role.color }}
                      />
                      {role.name}
                    </label>
                  ))}
                </div>
                <button
                  onClick={saveRoles}
                  disabled={savingRoles || !rolesLoaded}
                  className='self-start text-xs font-medium text-white bg-primary rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50'
                >
                  {savingRoles ? 'Збереження...' : 'Зберегти ролі'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}

export default EmployeeBlock
