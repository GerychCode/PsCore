'use client'
import React, { Suspense, useEffect, useState } from 'react'
import InputComponent from '@/app/components/forms/InputComponent'
import { SubmitHandler, useForm } from 'react-hook-form'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PathConfig } from '@/config/path.config'
import { authService } from '@/service/auth.service'
import { toast } from 'sonner'
import axios from 'axios'

type Inputs = { password: string; confirm: string }

const ResetForm = () => {
  const params = useSearchParams()
  // Захоплюємо токен один раз і прибираємо його з URL (історія браузера/Referer)
  const [token] = useState(() => params.get('token') ?? '')
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])
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
      await authService.resetPassword(token, data.password)
      toast.success('Пароль оновлено! Тепер увійдіть.')
      router.replace(PathConfig.LOGIN)
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ||
          error.response?.data?.errors?.[0]?.message
        : null
      toast.error(message || 'Не вдалося скинути пароль.')
    } finally {
      setIsPending(false)
    }
  }

  if (!token) {
    return (
      <div className='flex flex-col items-center gap-4 text-center'>
        <p className='text-gray-600'>Посилання неповне або пошкоджене.</p>
        <Link className='text-primary underline' href={PathConfig.FORGOT_PASSWORD}>
          Запросити нове
        </Link>
      </div>
    )
  }

  return (
    <form
      className='w-full flex flex-col items-center gap-5'
      onSubmit={handleSubmit(onSubmit)}
    >
      <InputComponent
        {...register('password', {
          required: 'Це поле є обов`язковим',
          minLength: { value: 8, message: 'Мінімум 8 символів' },
          pattern: {
            value: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/,
            message: 'Великі й малі літери та хоча б одна цифра',
          },
        })}
        errors={errors.password?.message}
        type='password'
        label='Новий пароль'
        placeholder='Новий пароль'
        ico='/password-svgrepo-com.svg'
      />
      <InputComponent
        {...register('confirm', {
          required: 'Це поле є обов`язковим',
          validate: (v) => v === watch('password') || 'Паролі не збігаються',
        })}
        errors={errors.confirm?.message}
        type='password'
        label='Повторіть пароль'
        placeholder='Повторіть пароль'
        ico='/password-svgrepo-com.svg'
      />
      <button
        disabled={isPending}
        className='h-12 w-full rounded-2xl border-2 border-gray-200 p-3 bg-primary text-white text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-50'
      >
        {isPending ? 'Зберігаємо...' : 'Змінити пароль'}
      </button>
    </form>
  )
}

const Page = () => (
  <main className='bg-gray-100 min-h-screen w-full flex items-center justify-center p-4'>
    <section className='w-full max-w-130 rounded-2xl mx-auto bg-white shadow-sm p-12 border-1 border-gray-50 flex flex-col items-center gap-6'>
      <div className='flex flex-col items-center w-full gap-3'>
        <h1 className='text-4xl font-bold text-center text-gray-900'>
          Новий пароль
        </h1>
        <h3>WorkCore</h3>
      </div>
      <Suspense fallback={<p className='text-gray-400'>Завантаження...</p>}>
        <ResetForm />
      </Suspense>
    </section>
  </main>
)

export default Page
