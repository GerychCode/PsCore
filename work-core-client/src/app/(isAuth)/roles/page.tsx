'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FaTrash, FaPlus } from 'react-icons/fa'
import { userStore } from '@/store/user.store'
import { PathConfig } from '@/config/path.config'
import {
  rolesService,
  IAppRoleWithCount,
  PERMISSION_LABELS,
} from '@/service/roles.service'

const DEFAULT_COLOR = '#5865F2'

export default function RolesPage() {
  const router = useRouter()
  const hasPermission = userStore((s) => s.hasPermission)
  const canManage = hasPermission('MANAGE_ROLES')

  const [roles, setRoles] = useState<IAppRoleWithCount[]>([])
  const [allPermissions, setAllPermissions] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<IAppRoleWithCount> | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        rolesService.getAll(),
        rolesService.getPermissions(),
      ])
      setRoles(rolesRes.data)
      setAllPermissions(permsRes.data)
    } catch {
      toast.error('Не вдалося завантажити ролі')
    }
  }

  useEffect(() => {
    if (!canManage) {
      router.replace(PathConfig.DASHBOARD)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage])

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId]
  )

  const startEdit = (role: IAppRoleWithCount) => {
    setSelectedId(role.id)
    setDraft({ ...role, permissions: [...role.permissions] })
  }

  const startCreate = () => {
    setSelectedId(null)
    setDraft({
      name: '',
      color: DEFAULT_COLOR,
      permissions: [],
      position: 0,
      isDefault: false,
    })
  }

  const togglePermission = (perm: string) => {
    if (!draft) return
    const has = draft.permissions?.includes(perm)
    setDraft({
      ...draft,
      permissions: has
        ? draft.permissions!.filter((p) => p !== perm)
        : [...(draft.permissions ?? []), perm],
    })
  }

  const save = async () => {
    if (!draft || !draft.name?.trim()) {
      toast.error('Вкажіть назву ролі')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        name: draft.name,
        color: draft.color,
        permissions: draft.permissions,
        isDefault: draft.isDefault,
      }
      if (selectedId) {
        // Системним ролям права не міняємо на бекенді — надсилаємо без permissions
        const body = selected?.isSystem
          ? { name: payload.name, color: payload.color }
          : payload
        await rolesService.update(selectedId, body)
      } else {
        await rolesService.create(payload)
      }
      toast.success('Роль збережено')
      setDraft(null)
      setSelectedId(null)
      load()
    } catch (error: any) {
      toast.error(
        error?.response?.data?.errors?.[0]?.message ??
          error?.response?.data?.message ??
          'Не вдалося зберегти'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (role: IAppRoleWithCount) => {
    if (role.isSystem) return
    if (!confirm(`Видалити роль "${role.name}"?`)) return
    try {
      await rolesService.remove(role.id)
      toast.success('Роль видалено')
      if (selectedId === role.id) setDraft(null)
      load()
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Не вдалося видалити')
    }
  }

  if (!canManage) return null

  return (
    <div className='flex flex-col md:flex-row gap-5 h-full'>
      {/* Список ролей */}
      <div className='w-full md:w-72 shrink-0 bg-white rounded-2xl shadow-xs border border-secondary/10 p-4 flex flex-col'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='font-semibold text-black'>Ролі</h3>
          <button
            onClick={startCreate}
            className='flex items-center gap-1.5 text-xs font-medium text-white bg-primary rounded-lg px-2.5 py-1.5 hover:opacity-90'
          >
            <FaPlus size={10} /> Нова
          </button>
        </div>
        <ul className='flex flex-col gap-1 overflow-y-auto custom-scrollbar'>
          {roles.map((role) => (
            <li
              key={role.id}
              onClick={() => startEdit(role)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 ${
                selectedId === role.id ? 'bg-slate-100' : ''
              }`}
            >
              <span
                className='h-3 w-3 rounded-full shrink-0'
                style={{ backgroundColor: role.color }}
              />
              <span className='text-sm text-gray-800 truncate'>
                {role.name}
              </span>
              {role.isSystem && (
                <span className='text-[9px] uppercase text-gray-400 ml-auto'>
                  система
                </span>
              )}
              {!role.isSystem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(role)
                  }}
                  className='ml-auto text-gray-300 hover:text-red-500'
                >
                  <FaTrash size={11} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Редактор ролі */}
      <div className='flex-grow bg-white rounded-2xl shadow-xs border border-secondary/10 p-6'>
        {!draft ? (
          <p className='text-secondary text-sm'>
            Оберіть роль зліва або створіть нову.
          </p>
        ) : (
          <div className='flex flex-col gap-5 max-w-2xl'>
            <div className='flex items-center gap-4'>
              <input
                type='color'
                value={draft.color ?? DEFAULT_COLOR}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className='h-10 w-12 rounded cursor-pointer border border-gray-200'
              />
              <input
                type='text'
                value={draft.name ?? ''}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder='Назва ролі'
                className='flex-grow rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:border-primary'
              />
            </div>

            <label className='flex items-center gap-2 text-sm text-gray-600'>
              <input
                type='checkbox'
                checked={!!draft.isDefault}
                onChange={(e) =>
                  setDraft({ ...draft, isDefault: e.target.checked })
                }
                className='h-4 w-4 accent-primary'
              />
              Призначати автоматично новим користувачам
            </label>

            <div>
              <h4 className='font-semibold text-black mb-1'>Права доступу</h4>
              {selected?.isSystem && (
                <p className='text-xs text-amber-600 mb-2'>
                  Права системної ролі змінити не можна.
                </p>
              )}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                {allPermissions.map((perm) => (
                  <label
                    key={perm}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                      draft.permissions?.includes(perm)
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200'
                    } ${selected?.isSystem ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type='checkbox'
                      disabled={selected?.isSystem}
                      checked={draft.permissions?.includes(perm) ?? false}
                      onChange={() => togglePermission(perm)}
                      className='h-4 w-4 accent-primary'
                    />
                    {PERMISSION_LABELS[perm] ?? perm}
                  </label>
                ))}
              </div>
            </div>

            <div className='flex gap-3'>
              <button
                onClick={save}
                disabled={isSaving}
                className='rounded-xl bg-primary text-white px-5 py-2.5 font-medium hover:opacity-90 disabled:opacity-50'
              >
                {isSaving ? 'Збереження...' : 'Зберегти'}
              </button>
              <button
                onClick={() => {
                  setDraft(null)
                  setSelectedId(null)
                }}
                className='rounded-xl border-2 border-gray-200 px-5 py-2.5 font-medium'
              >
                Скасувати
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
