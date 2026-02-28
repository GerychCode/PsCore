'use client'

import React from 'react'
import { useGenerateTelegramCodeMutation } from '@/hooks/user/user.generate-telegram-code.mutation'
import { FaTelegramPlane } from 'react-icons/fa'
import SettingsRow from './SettingsRow'

const TelegramConnect = () => {
    const { mutate, data, isPending, isSuccess } =
        useGenerateTelegramCodeMutation()

    const code = data?.data?.code

    return (
        <div>
            <SettingsRow
                icon={FaTelegramPlane}
                title='Підключення до Telegram-бота'
                isClickable={false}
            >
                <p>Керуйте сповіщеннями та зв'язком з ботом.</p>
            </SettingsRow>
            <div className='bg-gray-50 p-4 md:p-6'>
                <div className='flex flex-col md:flex-row items-start md:items-center justify-between gap-4 max-w-4xl mx-auto'>
                    <div className='max-w-prose'>
                        <p className='text-gray-600'>
                            Згенеруйте унікальний код, щоб підключити ваш акаунт до нашого
                            Telegram-бота.
                        </p>
                        <p className='text-sm text-secondary mt-1'>
                            Код дійсний протягом 5 хвилин.
                        </p>
                    </div>
                    <div className='flex flex-col items-center gap-3 w-full md:w-auto shrink-0'>
                        {isSuccess && code && (
                            <div className='bg-primary/10 border-2 border-dashed border-primary/30 text-primary font-bold text-4xl tracking-widest rounded-lg px-6 py-3'>
                                {code}
                            </div>
                        )}
                        <button
                            onClick={() => mutate()}
                            disabled={isPending}
                            className='h-11 px-6 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed w-full'
                        >
                            {isPending ? 'Генерація...' : 'Отримати код'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TelegramConnect