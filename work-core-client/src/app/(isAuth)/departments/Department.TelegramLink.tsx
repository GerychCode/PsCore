'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FaTelegram, FaCopy, FaUnlink } from 'react-icons/fa'
import { departmentService } from '@/service/department.service'
import { ITelegramLinkCode } from '@/interface/IDepartment'

interface Props {
    departmentId: number
    departmentName: string
}

/**
 * Прив'язка Telegram-акаунта відділення. Chat id вручну не вводиться:
 * адмін генерує одноразовий код, який надсилають боту З АКАУНТА ВІДДІЛЕННЯ.
 * Так доводиться доступ до чату — інакше помилка в цифрі відправляла б
 * коди підтвердження змін стороннім людям.
 */
const DepartmentTelegramLink: React.FC<Props> = ({
    departmentId,
    departmentName,
}) => {
    const [linked, setLinked] = useState<boolean | null>(null)
    const [code, setCode] = useState<ITelegramLinkCode | null>(null)
    const [secondsLeft, setSecondsLeft] = useState(0)
    const [isBusy, setIsBusy] = useState(false)

    const loadStatus = async () => {
        try {
            const { data } = await departmentService.getTelegramStatus(departmentId)
            setLinked(data.linked)
        } catch {
            setLinked(false)
        }
    }

    useEffect(() => {
        loadStatus()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [departmentId])

    // Зворотний відлік життя коду; на нулі код зникає, щоб не показувати мертвий
    useEffect(() => {
        if (secondsLeft <= 0) {
            if (code && secondsLeft === 0) setCode(null)
            return
        }
        const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [secondsLeft])

    // Поки код активний, перевіряємо, чи його вже погасили з боку Telegram
    useEffect(() => {
        if (!code || secondsLeft <= 0) return
        const t = setInterval(loadStatus, 5000)
        return () => clearInterval(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, secondsLeft])

    useEffect(() => {
        if (linked && code) {
            setCode(null)
            setSecondsLeft(0)
            toast.success('Акаунт відділення підключено')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linked])

    const handleGenerate = async () => {
        setIsBusy(true)
        try {
            const { data } = await departmentService.createTelegramCode(departmentId)
            setCode(data)
            setSecondsLeft(data.expiresInSec)
        } catch {
            toast.error('Не вдалося згенерувати код')
        } finally {
            setIsBusy(false)
        }
    }

    const handleUnlink = async () => {
        setIsBusy(true)
        try {
            await departmentService.unlinkTelegram(departmentId)
            setLinked(false)
            toast.success('Акаунт відділення відключено')
        } catch {
            toast.error('Не вдалося відключити акаунт')
        } finally {
            setIsBusy(false)
        }
    }

    const copyCode = () => {
        if (!code) return
        navigator.clipboard.writeText(code.code)
        toast.success('Код скопійовано')
    }

    const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`

    return (
        <div className='border-t pt-4 mt-2'>
            <div className='flex items-center justify-between mb-2'>
                <span className='font-medium text-gray-800 flex items-center gap-2'>
                    <FaTelegram className='text-[#229ED9]' />
                    Telegram-акаунт відділення
                </span>
                {linked !== null && (
                    <span
                        className={`text-xs px-2 py-1 rounded-full ${
                            linked
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                        }`}
                    >
                        {linked ? 'Підключено' : 'Не підключено'}
                    </span>
                )}
            </div>

            <p className='text-xs text-gray-500 mb-3'>
                Сюди надходитимуть коди, які працівник вводить у боті, щоб
                підтвердити початок зміни.
            </p>

            {code ? (
                <div className='bg-gray-50 border rounded-lg p-3'>
                    <div className='flex items-center gap-3'>
                        <code className='text-lg font-mono tracking-widest'>
                            {code.code}
                        </code>
                        <button
                            type='button'
                            onClick={copyCode}
                            className='text-gray-400 hover:text-gray-700'
                            title='Скопіювати'
                        >
                            <FaCopy />
                        </button>
                        <span className='ml-auto text-sm text-gray-500'>
                            дійсний ще {mmss}
                        </span>
                    </div>
                    <p className='text-xs text-gray-600 mt-2'>
                        Надішліть цей код боту{' '}
                        <b>з Telegram-акаунта «{departmentName}»</b>. Сторінку можна
                        не оновлювати — статус зміниться сам.
                    </p>
                </div>
            ) : (
                <div className='flex flex-wrap gap-2'>
                    <button
                        type='button'
                        onClick={handleGenerate}
                        disabled={isBusy}
                        className='px-3 py-2 rounded-lg bg-[#229ED9] text-white text-sm font-medium disabled:opacity-60'
                    >
                        {linked ? 'Перепідключити' : 'Згенерувати код'}
                    </button>
                    {linked && (
                        <button
                            type='button'
                            onClick={handleUnlink}
                            disabled={isBusy}
                            className='px-3 py-2 rounded-lg border text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 disabled:opacity-60'
                        >
                            <FaUnlink />
                            Відключити
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default DepartmentTelegramLink
