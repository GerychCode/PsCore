'use client'
import React, { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PathConfig } from '@/config/path.config'
import { authService } from '@/service/auth.service'

type Status = 'loading' | 'success' | 'error'

const VerifyInner = () => {
  const params = useSearchParams()
  // Токен захоплюємо один раз і прибираємо з URL (історія/Referer)
  const [token] = useState(() => params.get('token') ?? '')
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const done = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (done.current) return
    done.current = true

    if (!token) {
      setStatus('error')
      setMessage('Посилання неповне або пошкоджене.')
      return
    }

    authService
      .verifyEmail(token)
      .then((res) => {
        setStatus('success')
        setMessage(res.data?.message || 'Пошту підтверджено!')
      })
      .catch((error) => {
        setStatus('error')
        setMessage(
          error?.response?.data?.message ||
            'Посилання недійсне або його час дії минув.'
        )
      })
  }, [token])

  return (
    <div className='flex flex-col items-center gap-5 text-center'>
      {status === 'loading' && (
        <p className='text-gray-500'>Підтверджуємо пошту...</p>
      )}
      {status === 'success' && (
        <>
          <div className='text-5xl'>✅</div>
          <p className='text-gray-700'>{message}</p>
          <Link
            className='h-12 w-full flex items-center justify-center rounded-2xl bg-primary text-white font-medium hover:opacity-95'
            href={PathConfig.LOGIN}
          >
            Увійти
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <div className='text-5xl'>⚠️</div>
          <p className='text-gray-700'>{message}</p>
          <Link className='text-primary underline' href={PathConfig.LOGIN}>
            Повернутись до входу
          </Link>
        </>
      )}
    </div>
  )
}

const Page = () => (
  <main className='bg-gray-100 min-h-screen w-full flex items-center justify-center p-4'>
    <section className='w-full max-w-130 rounded-2xl mx-auto bg-white shadow-sm p-12 border-1 border-gray-50 flex flex-col items-center gap-6'>
      <div className='flex flex-col items-center w-full gap-3'>
        <h1 className='text-4xl font-bold text-center text-gray-900'>
          Підтвердження пошти
        </h1>
        <h3>WorkCore</h3>
      </div>
      <Suspense fallback={<p className='text-gray-400'>Завантаження...</p>}>
        <VerifyInner />
      </Suspense>
    </section>
  </main>
)

export default Page
