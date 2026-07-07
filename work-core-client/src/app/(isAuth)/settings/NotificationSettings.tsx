'use client'

import React, { useEffect, useState } from 'react'
import { FaBell } from 'react-icons/fa'
import { toast } from 'sonner'
import SettingsRow from './SettingsRow'
import { userService } from '@/service/user.service'
import { userStore } from '@/store/user.store'
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPrefs,
} from '@/interface/IUser'

const CATEGORIES: { key: NotificationCategory; label: string; hint: string }[] =
  [
    { key: 'shift', label: 'Зміни', hint: 'Підтвердження, відхилення, зміни' },
    { key: 'chat', label: 'Чат', hint: 'Нові повідомлення' },
    { key: 'schedule', label: 'Графік', hint: 'Оновлення розкладу' },
    { key: 'system', label: 'Системні', hint: 'Важливі сповіщення' },
  ]

const CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: 'web', label: 'У застосунку' },
  { key: 'telegram', label: 'Telegram' },
]

const Toggle = ({
  on,
  onClick,
}: {
  on: boolean
  onClick: () => void
}) => (
  <button
    type='button'
    onClick={onClick}
    className={`relative h-6 w-11 rounded-full transition-colors ${
      on ? 'bg-primary' : 'bg-gray-300'
    }`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
        on ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
)

export default function NotificationSettings() {
  const user = userStore((s) => s.user)
  const setNotificationPrefs = userStore((s) => s.setNotificationPrefs)

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    userService
      .getNotificationPrefs()
      .then((res) => setPrefs(res.data))
      .catch(() => {})
  }, [])

  const toggle = async (
    category: NotificationCategory,
    channel: NotificationChannel
  ) => {
    if (!prefs) return
    const next: NotificationPrefs = {
      ...prefs,
      [category]: {
        ...prefs[category],
        [channel]: !prefs[category][channel],
      },
    }
    setPrefs(next)
    setSaving(true)
    try {
      const res = await userService.updateNotificationPrefs(next)
      setNotificationPrefs(res.data)
    } catch {
      toast.error('Не вдалося зберегти')
      // відкат
      setPrefs(prefs)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SettingsRow
        icon={FaBell}
        title='Сповіщення'
        isClickable={false}
      >
        <p>Окремо для застосунку та Telegram.</p>
      </SettingsRow>

      <div className='p-4 md:p-6 bg-gray-50'>
        {!prefs ? (
          <p className='text-secondary text-sm'>Завантаження...</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[420px] text-sm'>
              <thead>
                <tr className='text-secondary'>
                  <th className='text-left font-medium pb-3'>Категорія</th>
                  {CHANNELS.map((ch) => (
                    <th key={ch.key} className='text-center font-medium pb-3 px-2'>
                      {ch.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-200'>
                {CATEGORIES.map((cat) => (
                  <tr key={cat.key}>
                    <td className='py-3 pr-4'>
                      <div className='font-medium text-gray-800'>
                        {cat.label}
                      </div>
                      <div className='text-xs text-secondary'>{cat.hint}</div>
                    </td>
                    {CHANNELS.map((ch) => (
                      <td key={ch.key} className='py-3 text-center'>
                        <div className='flex justify-center'>
                          <Toggle
                            on={prefs[cat.key]?.[ch.key] ?? true}
                            onClick={() => toggle(cat.key, ch.key)}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {saving && (
              <p className='text-xs text-secondary mt-3'>Збереження…</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
