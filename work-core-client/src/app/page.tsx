'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FaCalendarAlt, FaChartLine, FaArrowRight } from 'react-icons/fa'
import { IoMdTime } from 'react-icons/io'
import { userStore } from '@/store/user.store'

export default function Home() {
  const user = userStore((state) => state.user)
  const [isMounted, setIsMounted] = useState(false)

  // Використовуємо useEffect, щоб переконатися, що код виконується на клієнті
  // Це запобігає помилкам гідратації при роботі з localStorage
  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
      <div className='min-h-screen bg-white flex flex-col'>
        {/* --- HEADER --- */}
        <header className='w-full border-b border-gray-100 bg-white/80 backdrop-blur-md fixed top-0 z-50'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='flex justify-between items-center h-16'>
              {/* Logo */}
              <div className='flex items-center gap-2'>
                <Image
                    src='/logo.svg'
                    alt='2Work Logo'
                    width={32}
                    height={32}
                    className='w-8 h-8'
                />
                <span className='font-bold text-xl text-gray-900'>2Work</span>
              </div>

              {/* Auth Buttons або Dashboard */}
              <div className='flex items-center gap-4'>
                {isMounted && user ? (
                    <Link
                        href='/dashboard'
                        className='flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-primary hover:bg-primary/90 transition shadow-sm'
                    >
                      Відкрити робочий стіл
                    </Link>
                ) : (
                    <>
                      <Link
                          href='/auth/login'
                          className='text-sm font-medium text-gray-600 hover:text-primary transition-colors'
                      >
                        Вхід
                      </Link>
                      <Link
                          href='/auth/registration'
                          className='hidden sm:flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-primary hover:bg-primary/90 transition shadow-sm'
                      >
                        Реєстрація
                      </Link>
                    </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* --- HERO SECTION --- */}
        <main className='flex-grow pt-24 pb-12'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='text-center max-w-3xl mx-auto mt-10 md:mt-20'>
              <h1 className='text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl'>
                <span className='block'>Ефективне управління</span>
                <span className='block text-primary'>робочим часом</span>
              </h1>
              <p className='mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl'>
                Система для автоматизації графіків, обліку змін та контролю співробітників.
                Простота для персоналу, потужна аналітика для керівників.
              </p>
              <div className='mt-10 max-w-sm mx-auto sm:max-w-none sm:flex sm:justify-center gap-4'>
                {isMounted && user ? (
                    <Link
                        href='/dashboard'
                        className='w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-2xl text-white bg-primary hover:bg-primary/90 md:py-4 md:text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1'
                    >
                      Перейти до Dashboard
                      <FaArrowRight className='ml-2 text-sm' />
                    </Link>
                ) : (
                    <>
                      <Link
                          href='/auth/registration'
                          className='w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-2xl text-white bg-primary hover:bg-primary/90 md:py-4 md:text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1'
                      >
                        Розпочати роботу
                      </Link>
                      <Link
                          href='/auth/login'
                          className='mt-3 w-full flex items-center justify-center px-8 py-3 border border-gray-200 text-base font-medium rounded-2xl text-gray-700 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:mt-0 transition shadow-sm'
                      >
                        Увійти в акаунт
                      </Link>
                    </>
                )}
              </div>
            </div>

            {/* --- FEATURES GRID --- */}
            <div className='mt-24 md:mt-32'>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12'>
                {/* Feature 1 */}
                <div className='flex flex-col items-center text-center p-6 rounded-3xl bg-gray-50 border border-gray-100 hover:border-primary/20 transition duration-300'>
                  <div className='flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-100 text-primary mb-6'>
                    <FaCalendarAlt className='text-3xl' />
                  </div>
                  <h3 className='text-xl font-bold text-gray-900 mb-3'>
                    Гнучкий графік
                  </h3>
                  <p className='text-gray-500 leading-relaxed'>
                    Створюйте та редагуйте робочі зміни в кілька кліків.
                    Зручний календарний вигляд для менеджерів та співробітників.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className='flex flex-col items-center text-center p-6 rounded-3xl bg-gray-50 border border-gray-100 hover:border-primary/20 transition duration-300'>
                  <div className='flex items-center justify-center h-16 w-16 rounded-2xl bg-purple-100 text-purple-600 mb-6'>
                    <IoMdTime className='text-4xl' />
                  </div>
                  <h3 className='text-xl font-bold text-gray-900 mb-3'>
                    Облік часу
                  </h3>
                  <p className='text-gray-500 leading-relaxed'>
                    Точна фіксація початку та кінця робочого дня.
                    Автоматичний підрахунок відпрацьованих годин та перерв.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className='flex flex-col items-center text-center p-6 rounded-3xl bg-gray-50 border border-gray-100 hover:border-primary/20 transition duration-300'>
                  <div className='flex items-center justify-center h-16 w-16 rounded-2xl bg-green-100 text-green-600 mb-6'>
                    <FaChartLine className='text-3xl' />
                  </div>
                  <h3 className='text-xl font-bold text-gray-900 mb-3'>
                    Звітність
                  </h3>
                  <p className='text-gray-500 leading-relaxed'>
                    Генеруйте детальні звіти по кожному співробітнику.
                    Контролюйте запізнення та ефективність роботи відділень.
                  </p>
                </div>
              </div>
            </div>

            {/* --- CTA SECTION --- */}
            <div className='mt-24 md:mt-32 bg-primary rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden mb-12'>
              <div className='relative z-10'>
                <h2 className='text-3xl font-bold mb-4'>
                  Готові оптимізувати свій бізнес?
                </h2>
                <p className='text-primary-100 text-lg mb-8 max-w-2xl mx-auto'>
                  Приєднуйтесь до 2Work сьогодні та отримайте повний контроль над робочим процесом.
                </p>

                {isMounted && user ? (
                    <Link
                        href='/dashboard'
                        className='inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-xl text-primary bg-white hover:bg-gray-100 transition shadow-md'
                    >
                      Перейти до системи
                      <FaArrowRight className='ml-2' />
                    </Link>
                ) : (
                    <Link
                        href='/auth/registration'
                        className='inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-xl text-primary bg-white hover:bg-gray-100 transition shadow-md'
                    >
                      Створити акаунт
                      <FaArrowRight className='ml-2' />
                    </Link>
                )}
              </div>

              {/* Decorative circles */}
              <div className='absolute top-0 left-0 -ml-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-2xl'></div>
              <div className='absolute bottom-0 right-0 -mr-10 -mb-10 w-40 h-40 bg-white/10 rounded-full blur-2xl'></div>
            </div>
          </div>
        </main>

        {/* --- FOOTER --- */}
        <footer className='bg-white border-t border-gray-100 py-8'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4'>
            <div className='flex items-center gap-2 opacity-75'>
              <Image
                  src='/logo.svg'
                  alt='2Work Logo'
                  width={24}
                  height={24}
              />
              <span className='font-semibold text-gray-900'>2Work</span>
            </div>
            <p className='text-sm text-gray-500'>
              © {new Date().getFullYear()} WorkCore System. Усі права захищено.
            </p>
          </div>
        </footer>
      </div>
  )
}