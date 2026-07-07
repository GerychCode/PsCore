'use client'
import React, { useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { toast } from 'sonner'
import axios from 'axios'
import InputComponent from '@/app/components/forms/InputComponent'
import { authService } from '@/service/auth.service'

interface Props {
  onDone: () => void
}

type Inputs = {
  currentPassword: string
  newPassword: string
  confirm: string
}

/**
 * Блокуючий екран: показується, поки user.mustChangePassword === true
 * (щойно засіяний суперадмін після першого входу).
 */
export default function ForcePasswordChange({ onDone }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Inputs>()
  const [isPending, setIsPending] = useState(false)

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsPending(true)
    try {
      await authService.changePassword(data.currentPassword, data.newPassword)
      toast.success('Пароль змінено.')
      onDone()
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ||
          error.response?.data?.errors?.[0]?.message
        : null
      toast.error(message || 'Не вдалося змінити пароль.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className='fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4'>
      <div className='w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-5'>
        <div>
          <h2 className='text-2xl font-bold text-gray-900'>Змініть пароль</h2>
          <p className='text-sm text-gray-500 mt-1'>
            Це ваш перший вхід. Задайте власний пароль, щоб продовжити.
          </p>
        </div>
        <form
          className='flex flex-col gap-4'
          onSubmit={handleSubmit(onSubmit)}
        >
          <InputComponent
            {...register('currentPassword', {
              required: 'Це поле є обов`язковим',
            })}
            errors={errors.currentPassword?.message}
            type='password'
            label='Поточний (тимчасовий) пароль'
            placeholder='Пароль з консолі'
          />
          <InputComponent
            {...register('newPassword', {
              required: 'Це поле є обов`язковим',
              minLength: { value: 8, message: 'Мінімум 8 символів' },
              pattern: {
                value: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/,
                message: 'Великі й малі літери та хоча б одна цифра',
              },
            })}
            errors={errors.newPassword?.message}
            type='password'
            label='Новий пароль'
            placeholder='Новий пароль'
          />
          <InputComponent
            {...register('confirm', {
              required: 'Це поле є обов`язковим',
              validate: (v) =>
                v === watch('newPassword') || 'Паролі не збігаються',
            })}
            errors={errors.confirm?.message}
            type='password'
            label='Повторіть новий пароль'
            placeholder='Повторіть пароль'
          />
          <button
            disabled={isPending}
            className='h-12 w-full rounded-2xl bg-primary text-white font-medium hover:opacity-95 disabled:opacity-50'
          >
            {isPending ? 'Зберігаємо...' : 'Зберегти пароль'}
          </button>
        </form>
      </div>
    </div>
  )
}
