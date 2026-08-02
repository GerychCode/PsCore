'use client'

import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { toast } from 'sonner'
import { FaPlus, FaCheck, FaTimes, FaBan } from 'react-icons/fa'
import { userStore } from '@/store/user.store'
import { absenceService } from '@/service/absence.service'
import {
    ABSENCE_STATUS_LABELS,
    ABSENCE_STATUS_STYLES,
    ABSENCE_TYPE_LABELS,
    IAbsence,
} from '@/interface/IAbsence'
import AbsenceModal from './Absence.Modal'

const dateRange = (from: string, to: string) => {
    const f = format(new Date(from), 'd MMM', { locale: uk })
    const t = format(new Date(to), 'd MMM yyyy', { locale: uk })
    return f === t.replace(/ \d{4}$/, '') ? t : `${f} — ${t}`
}

const Page = () => {
    const user = userStore((state) => state.user)
    const hasPermission = userStore((state) => state.hasPermission)
    const canManage = hasPermission('MANAGE_SCHEDULE')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const queryClient = useQueryClient()

    const { data: listResponse, isLoading } = useQuery({
        queryKey: ['absences'],
        queryFn: () => absenceService.list(),
    })

    const { data: balanceResponse } = useQuery({
        queryKey: ['absence-balance'],
        queryFn: () => absenceService.balance(),
        enabled: !!user,
    })

    const absences = listResponse?.data ?? []
    const balance = balanceResponse?.data

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['absences'] })
        queryClient.invalidateQueries({ queryKey: ['absence-balance'] })
        queryClient.invalidateQueries({ queryKey: ['week-view'] })
    }

    const review = useMutation({
        mutationFn: async ({
            id,
            action,
        }: {
            id: number
            action: 'approve' | 'reject' | 'cancel'
        }) => {
            if (action === 'approve') return absenceService.approve(id)
            if (action === 'reject') return absenceService.reject(id)
            return absenceService.cancel(id)
        },
        onSuccess: (res, { action }) => {
            const freed = (res.data as IAbsence)?.freedScheduleDays ?? 0
            if (action === 'approve') {
                // Про звільнені зміни треба сказати вголос: покриття впало,
                // і тиждень, найімовірніше, треба перегенерувати.
                toast.success(
                    freed > 0
                        ? `Погоджено. Знято ${freed} планових змін — перевірте графік.`
                        : 'Відсутність погоджено'
                )
            } else if (action === 'reject') {
                toast.success('Заявку відхилено')
            } else {
                toast.success('Заявку скасовано')
            }
            refresh()
        },
        onError: (e: any) =>
            toast.error(
                e?.response?.data?.message ??
                    e?.response?.data?.errors?.[0]?.message ??
                    'Не вдалося виконати дію'
            ),
    })

    const pending = absences.filter((a) => a.status === 'PENDING')
    const rest = absences.filter((a) => a.status !== 'PENDING')

    const row = (a: IAbsence) => {
        const isMine = a.userId === user?.id
        return (
            <div
                key={a.id}
                className='flex flex-wrap items-center gap-3 border-b border-gray-100 py-3 last:border-0'
            >
                <div className='min-w-[9rem]'>
                    <span className='font-medium text-black'>
                        {ABSENCE_TYPE_LABELS[a.type]}
                    </span>
                </div>
                <div className='min-w-[11rem] text-sm text-gray-600'>
                    {dateRange(a.startDate, a.endDate)}
                </div>
                {canManage && a.user && (
                    <div className='min-w-[10rem] text-sm text-gray-800'>
                        {a.user.firstName} {a.user.lastName}
                    </div>
                )}
                <span
                    className={`text-xs px-2 py-1 rounded-full ${ABSENCE_STATUS_STYLES[a.status]}`}
                >
                    {ABSENCE_STATUS_LABELS[a.status]}
                </span>
                {a.reason && (
                    <span className='text-sm text-gray-500 italic'>{a.reason}</span>
                )}

                <div className='ml-auto flex gap-2'>
                    {canManage && a.status === 'PENDING' && (
                        <>
                            <button
                                onClick={() =>
                                    review.mutate({ id: a.id, action: 'approve' })
                                }
                                disabled={review.isPending}
                                className='flex items-center gap-1.5 rounded-lg bg-green-600 text-white px-3 py-1.5 text-sm disabled:opacity-50'
                            >
                                <FaCheck /> Погодити
                            </button>
                            <button
                                onClick={() =>
                                    review.mutate({ id: a.id, action: 'reject' })
                                }
                                disabled={review.isPending}
                                className='flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-red-600 disabled:opacity-50'
                            >
                                <FaTimes /> Відхилити
                            </button>
                        </>
                    )}
                    {(isMine || canManage) &&
                        (a.status === 'PENDING' || a.status === 'APPROVED') && (
                            <button
                                onClick={() =>
                                    review.mutate({ id: a.id, action: 'cancel' })
                                }
                                disabled={review.isPending}
                                className='flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-gray-600 disabled:opacity-50'
                            >
                                <FaBan /> Скасувати
                            </button>
                        )}
                </div>
            </div>
        )
    }

    return (
        <div className='p-4 sm:p-6 flex flex-col gap-5'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <h1 className='text-2xl font-semibold text-black'>Відсутності</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className='flex items-center gap-2 rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:opacity-90'
                >
                    <FaPlus /> Подати заявку
                </button>
            </div>

            {balance && (
                <div className='rounded-2xl border border-secondary/10 bg-white p-5 shadow-xs'>
                    <h2 className='font-semibold text-black mb-3'>
                        Відпустка, {balance.year}
                    </h2>
                    <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
                        {[
                            ['Норма', balance.entitled],
                            ['Використано', balance.used],
                            ['У заявках', balance.pending],
                            ['Залишок', balance.remaining],
                        ].map(([label, value]) => (
                            <div key={label as string}>
                                <p className='text-sm text-gray-500'>{label}</p>
                                <p className='text-2xl font-semibold text-black'>
                                    {value} <span className='text-base'>дн.</span>
                                </p>
                            </div>
                        ))}
                    </div>
                    <p className='text-xs text-gray-500 mt-3'>
                        «У заявках» уже відняті від залишку — інакше кількома
                        заявками можна було б вибрати понад норму.
                    </p>
                </div>
            )}

            {isLoading ? (
                <p className='text-gray-500'>Завантаження…</p>
            ) : absences.length === 0 ? (
                <p className='text-gray-500'>Заявок ще немає.</p>
            ) : (
                <>
                    {canManage && pending.length > 0 && (
                        <div className='rounded-2xl border border-amber-200 bg-amber-50/40 p-5'>
                            <h2 className='font-semibold text-black mb-2'>
                                Чекають рішення ({pending.length})
                            </h2>
                            {pending.map(row)}
                        </div>
                    )}
                    <div className='rounded-2xl border border-secondary/10 bg-white p-5 shadow-xs'>
                        <h2 className='font-semibold text-black mb-2'>
                            {canManage ? 'Решта заявок' : 'Мої заявки'}
                        </h2>
                        {(canManage ? rest : absences).map(row)}
                    </div>
                </>
            )}

            <AbsenceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreated={refresh}
                canManage={canManage}
            />
        </div>
    )
}

export default Page
