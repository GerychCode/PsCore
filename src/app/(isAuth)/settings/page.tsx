'use client'
import React from 'react'
import { FaKey, FaBell, FaEnvelope, FaUserShield } from 'react-icons/fa'
import SettingsRow from './SettingsRow'
import TelegramConnect from './TelegramConnect'

export default function SettingsPage() {
    return (
        <div className='w-full max-w-4xl mx-auto'>
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
                    {/* --- Telegram --- */}
                    <TelegramConnect />

                    {/*/!* --- Інші налаштування (плейсхолдери) --- *!/*/}
                    {/*<SettingsRow icon={FaKey} title='Пароль' onClick={() => {}}>*/}
                    {/*    <p>Останнє оновлення: 21 лист. 2022р.</p>*/}
                    {/*</SettingsRow>*/}

                    {/*<SettingsRow*/}
                    {/*    icon={FaUserShield}*/}
                    {/*    title='Двохетапна автентифікація'*/}
                    {/*    onClick={() => {}}*/}
                    {/*>*/}
                    {/*    <p className='flex items-center gap-2 text-green-600'>*/}
                    {/*        <span className='w-2 h-2 rounded-full bg-green-500'></span>*/}
                    {/*        Увімкнено*/}
                    {/*    </p>*/}
                    {/*</SettingsRow>*/}

                    {/*<SettingsRow*/}
                    {/*    icon={FaEnvelope}*/}
                    {/*    title='Резервний email'*/}
                    {/*    onClick={() => {}}*/}
                    {/*>*/}
                    {/*    <p className='text-yellow-600'>Потребує підтвердження</p>*/}
                    {/*</SettingsRow>*/}

                    {/*<SettingsRow icon={FaBell} title='Сповіщення' onClick={() => {}}>*/}
                    {/*    <p>Керування сповіщеннями з пристроїв</p>*/}
                    {/*</SettingsRow>*/}
                </div>
            </div>
        </div>
    )
}