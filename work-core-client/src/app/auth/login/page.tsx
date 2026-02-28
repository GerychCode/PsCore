'use client'
import React from 'react'
import InputComponent from '@/app/components/forms/InputComponent'
import { SubmitHandler, useForm } from 'react-hook-form'
import Link from 'next/link'
import { IUserLogin } from '@/interface/IUserAuth'
import { useRouter } from 'next/navigation'
import { PathConfig } from '@/config/path.config'
import { useLoginMutation } from '@/hooks/user/user.login.mutation'

const Page = () => {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<{
    email: string
    password: string
  }>()

  const router = useRouter()

  const { mutate, isPending } = useLoginMutation(reset, setError, () =>
    router.replace(PathConfig.DASHBOARD)
  )

  const onSubmit: SubmitHandler<IUserLogin> = (data) => {
    mutate(data)
  }

  return (
    <main className='bg-gray-100 min-h-screen w-full flex items-center justify-center p-4'>
      <section className='w-full max-w-130 rounded-2xl mx-auto bg-white shadow-sm p-12 border-1 border-gray-50 flex flex-col items-center gap-6 p-6'>
        <div className='flex flex-col items-center w-full gap-3'>
          <h1 className='text-5xl font-bold text-center text-gray-900'>
            Авторизація
          </h1>
          <h3>WorkCore</h3>
        </div>
        <form
          className='w-full flex flex-col items-center gap-5'
          onSubmit={handleSubmit(onSubmit)}
        >
          <InputComponent
            {...register('email', {
              required: 'Це поле є обов`язковим',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Неправельний формат пошти!',
              },
            })}
            name='email'
            errors={errors.email?.message}
            label='Email'
            placeholder='printstudio.top@gmail.com'
            ico='/email-svgrepo-com.svg'
          ></InputComponent>
          <InputComponent
            {...register('password', {
              required: 'Це поле є обов`язковим',
            })}
            errors={errors.password?.message}
            type='password'
            label='Password'
            placeholder='Пароль'
            ico='/password-svgrepo-com.svg'
          ></InputComponent>
          <div className='flex flex-col w-full gap-3'>
            <Link
              className='text-primary underline w-full text-right'
              href={PathConfig.FORGOT_PASSWORD}
            >
              {' '}
              Забув пароль?
            </Link>
          </div>
          <button className='h-12 w-full rounded-2xl border-2 border-gray-200 p-3 bg-primary text-white text-base font-medium hover:opacity-95 hover:shadow-sm'>
            {!isPending ? 'Увійти' : 'Завантаження...'}
          </button>
          <p>
            {' '}
            Ще не маєте свого аккаунту?
            <Link
              className='text-primary underline'
              href={PathConfig.REGISTER}
              type='submit'
            >
              {' '}
              Зареєструйся
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}

export default Page
