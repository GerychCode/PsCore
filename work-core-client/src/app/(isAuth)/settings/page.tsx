'use client'
import React from 'react'
import TelegramConnect from './TelegramConnect'
import ThemeToggle from './ThemeToggle'
import NotificationSettings from './NotificationSettings'

export default function SettingsPage() {
    return (
        <div className='w-full max-w-4xl mx-auto flex flex-col gap-6'>
            <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden'>
                <div className='p-6 border-b border-gray-200'>
                    <h1 className='text-2xl font-bold text-gray-800 mb-1'>
                        Налаштування
                    </h1>
                    <p className='text-secondary'>
                        Керуйте налаштуваннями вашого акаунту.
                    </p>
                </div>

                <div className='flex flex-col'>
                    <TelegramConnect />
                </div>
            </div>

            <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden'>
                <div className='p-6 border-b border-gray-200'>
                    <h2 className='text-xl font-bold text-gray-800 mb-1'>
                        Сповіщення
                    </h2>
                    <p className='text-secondary'>
                        Оберіть, що і куди надсилати.
                    </p>
                </div>
                <div className='flex flex-col'>
                    <NotificationSettings />
                </div>
            </div>

            <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden'>
                <div className='p-6 border-b border-gray-200'>
                    <h2 className='text-xl font-bold text-gray-800 mb-1'>
                        Вигляд
                    </h2>
                    <p className='text-secondary'>
                        Налаштуйте оформлення інтерфейсу.
                    </p>
                </div>

                <div className='flex flex-col'>
                    <ThemeToggle />
                </div>
            </div>
        </div>
    )
}