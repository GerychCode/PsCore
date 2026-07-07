'use client'

import React, { Suspense, useEffect, useState } from 'react'
import InputComponent from '@/app/components/forms/InputComponent'
import { SubmitHandler, useForm } from 'react-hook-form'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PathConfig } from '@/config/path.config'
import { invitationService, IInvitationInfo } from '@/service/invitation.service'
import { toast } from 'sonner'
import axios from 'axios'

type Inputs = { password: string; confirm: string }

const InviteForm = () => {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const router = useRouter()

  const [info, setInfo] = useState<IInvitationInfo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>(
    'loading'
  )
  const [isPending, setIsPending] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Inputs>()

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    invitationService
      .getByToken(token)
      .then((res) => {
        setInfo(res.data)
        setStatus('ready')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsPending(true)
    try {
      await invitationService.accept(token, data.password)
      toast.success('Реєстрацію завершено! Тепер увійдіть.')
      router.replace(PathConfig.LOGIN)
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ||
          error.response?.data?.errors?.[0]?.message
        : null
      toast.error(message || 'Не вдалося завершити реєстрацію.')
    } finally {
      setIsPending(false)
    }
  }

  if (status === 'loading') {
    return <p className='text-gray-400'>Завантаження запрошення...</p>
  }

  if (status === 'invalid') {
    return (
      <div className='flex flex-col items-center gap-4 text-center'>
        <div className='text-5xl'>⚠️</div>
        <p className='text-gray-700'>
          Запрошення недійсне або його час дії минув. Зверніться до
          адміністратора.
        </p>
        <Link className='text-primary underline' href={PathConfig.LOGIN}>
          До входу
        </Link>
      </div>
    )
  }

  return (
    <form
      className='w-full flex flex-col items-center gap-5'
      onSubmit={handleSubmit(onSubmit)}
    >
      <p className='text-gray-500 text-sm text-center'>
        Вітаємо, {info?.firstName} {info?.lastName}! Задайте пароль, щоб
        завершити реєстрацію.
      </p>

      <div className='w-full flex flex-col gap-1'>
        <label className='text-sm text-gray-600'>Email</label>
        <input
          value={info?.email ?? ''}
          disabled
          className='rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-gray-500'
        />
      </div>

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
        label='Пароль'
        placeholder='Пароль'
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
        {isPending ? 'Завершуємо...' : 'Завершити реєстрацію'}
      </button>
    </form>
  )
}

const Page = () => (
  <main className='bg-gray-100 min-h-screen w-full flex items-center justify-center p-4'>
    <section className='w-full max-w-130 rounded-2xl mx-auto bg-white shadow-sm p-12 border-1 border-gray-50 flex flex-col items-center gap-6'>
      <div className='flex flex-col items-center w-full gap-3'>
        <h1 className='text-4xl font-bold text-center text-gray-900'>
          Реєстрація
        </h1>
        <h3>WorkCore</h3>
      </div>
      <Suspense fallback={<p className='text-gray-400'>Завантаження...</p>}>
        <InviteForm />
      </Suspense>
    </section>
  </main>
)

export default Page
