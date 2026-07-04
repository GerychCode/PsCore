'use client'
import React, { useState } from 'react'
import InputComponent from '@/app/components/forms/InputComponent'
import { SubmitHandler, useForm } from 'react-hook-form'
import Link from 'next/link'
import { PathConfig } from '@/config/path.config'
import { authService } from '@/service/auth.service'
import { toast } from 'sonner'

type Inputs = { email: string }

const Page = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>()
  const [sent, setSent] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsPending(true)
    try {
      await authService.forgotPassword(data.email)
      setSent(true)
    } catch {
      toast.error('Виникла помилка, спробуйте пізніше!')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <main className='bg-gray-100 min-h-screen w-full flex items-center justify-center p-4'>
      <section className='w-full max-w-130 rounded-2xl mx-auto bg-white shadow-sm p-12 border-1 border-gray-50 flex flex-col items-center gap-6'>
        <div className='flex flex-col items-center w-full gap-3'>
          <h1 className='text-4xl font-bold text-center text-gray-900'>
            Відновлення пароля
          </h1>
          <h3>WorkCore</h3>
        </div>

        {sent ? (
          <div className='flex flex-col items-center gap-4 text-center'>
            <p className='text-gray-600'>
              Якщо акаунт із такою поштою існує — ми надіслали лист із
              посиланням для скидання пароля. Перевірте вхідні.
            </p>
            <Link className='text-primary underline' href={PathConfig.LOGIN}>
              Повернутись до входу
            </Link>
          </div>
        ) : (
          <form
            className='w-full flex flex-col items-center gap-5'
            onSubmit={handleSubmit(onSubmit)}
          >
            <p className='text-gray-500 text-sm text-center'>
              Введіть пошту акаунта — надішлемо посилання для скидання пароля.
            </p>
            <InputComponent
              {...register('email', {
                required: 'Це поле є обов`язковим',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Неправильний формат пошти!',
                },
              })}
              name='email'
              errors={errors.email?.message}
              label='Email'
              placeholder='printstudio.top@gmail.com'
              ico='/email-svgrepo-com.svg'
            />
            <button
              disabled={isPending}
              className='h-12 w-full rounded-2xl border-2 border-gray-200 p-3 bg-primary text-white text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-50'
            >
              {isPending ? 'Надсилаємо...' : 'Надіслати посилання'}
            </button>
            <Link className='text-primary underline' href={PathConfig.LOGIN}>
              Повернутись до входу
            </Link>
          </form>
        )}
      </section>
    </main>
  )
}

export default Page
