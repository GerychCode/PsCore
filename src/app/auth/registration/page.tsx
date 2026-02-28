'use client'

import React from 'react'
import InputComponent from '@/app/components/forms/InputComponent'
import { SubmitHandler, useForm } from 'react-hook-form'
import Link from 'next/link'
import { IUserRegister } from '@/interface/IUserAuth'
import { useRouter } from 'next/navigation'
import { PathConfig } from '@/config/path.config'
import { useRegistrationMutation } from '@/hooks/user/user.registration.mutation'

type Inputs = {
  firstName: string
  lastName: string
  email: string
  password: string
}

const Page = () => {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Inputs>()

  const router = useRouter()

  const { mutate, isPending } = useRegistrationMutation(reset, setError, () =>
    router.replace(PathConfig.DASHBOARD)
  )

  const onSubmit: SubmitHandler<IUserRegister> = (data: IUserRegister) => {
    mutate(data)
  }

  return (
    <main className='bg-gray-100 min-h-screen w-full flex items-center justify-center p-4'>
      <section className='w-full max-w-130 rounded-2xl mx-auto bg-white shadow-sm p-12 border-1 border-gray-50 flex flex-col items-center gap-6 p-6'>
        <div className='flex flex-col items-center w-full gap-3'>
          <h1 className='text-5xl font-bold text-center text-gray-900'>
            Реєстрація
          </h1>
          <h3>WorkCore</h3>
        </div>
        <form
          className='w-full flex flex-col items-center gap-5'
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className='flex flex-row gap-5 items-center justify-between'>
            <InputComponent
              {...register('firstName', {
                required: 'Це поле є обов`язковим',
              })}
              errors={errors.firstName?.message}
              type='text'
              label='Ім`я'
              placeholder='Ім`я'
            />
            <InputComponent
              {...register('lastName', {
                required: 'Це поле є обов`язковим',
              })}
              errors={errors.lastName?.message}
              type='text'
              label='Прізвище'
              placeholder='Ім`я'
            />
          </div>
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
          <button className='h-12 w-full rounded-2xl border-2 border-gray-200 p-3 bg-primary text-white text-base font-medium hover:opacity-95 hover:shadow-sm'>
            {!isPending ? 'Зареєструватись' : 'Завантаження...'}
          </button>
          <p>
            {' '}
            Вже маєш аккаунт?
            <Link className='text-primary underline' href={PathConfig.LOGIN}>
              {' '}
              Авторизація
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}

export default Page
