'use client'

import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import MyModal from '@/app/components/Modal'
import InputComponent from '@/app/components/forms/InputComponent'
import { absenceService } from '@/service/absence.service'
import {
    ABSENCE_TYPE_LABELS,
    AbsenceType,
    ICreateAbsence,
} from '@/interface/IAbsence'

interface Props {
    isOpen: boolean
    onClose: () => void
    onCreated: () => void
    canManage: boolean
}

const AbsenceModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onCreated,
    canManage,
}) => {
    const [type, setType] = useState<AbsenceType>('VACATION')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [reason, setReason] = useState('')

    const create = useMutation({
        mutationFn: (data: ICreateAbsence) => absenceService.create(data),
        onSuccess: (res) => {
            // Менеджер оформлює одразу погодженою — повідомлення різні,
            // щоб не здавалось, ніби заявка десь загубилась
            const status = (res.data as any)?.status
            toast.success(
                status === 'APPROVED'
                    ? 'Відсутність оформлено'
                    : 'Заявку подано — очікує рішення менеджера'
            )
            setReason('')
            setStartDate('')
            setEndDate('')
            onCreated()
            onClose()
        },
        onError: (e: any) =>
            toast.error(
                e?.response?.data?.message ??
                    e?.response?.data?.errors?.[0]?.message ??
                    'Не вдалося подати заявку'
            ),
    })

    const submit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!startDate || !endDate) {
            toast.error('Вкажіть період відсутності')
            return
        }
        create.mutate({ type, startDate, endDate, reason: reason || undefined })
    }

    return (
        <MyModal isOpen={isOpen} onClose={onClose}>
            <form onSubmit={submit} className='flex flex-col gap-5 p-1'>
                <h2 className='text-xl font-semibold text-black'>
                    Заявка на відсутність
                </h2>

                <div className='flex flex-col gap-1'>
                    <label className='text-sm text-gray-600'>Тип</label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as AbsenceType)}
                        className='rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:border-primary'
                    >
                        {(
                            Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]
                        ).map((t) => (
                            <option key={t} value={t}>
                                {ABSENCE_TYPE_LABELS[t]}
                            </option>
                        ))}
                    </select>
                    {type === 'VACATION' && (
                        <p className='text-xs text-gray-500'>
                            Дні списуються з річного балансу відпустки.
                        </p>
                    )}
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <InputComponent
                        type='date'
                        label='Перший день'
                        value={startDate}
                        onChange={(e: any) => setStartDate(e.target.value)}
                    />
                    <InputComponent
                        type='date'
                        label='Останній день (включно)'
                        value={endDate}
                        onChange={(e: any) => setEndDate(e.target.value)}
                    />
                </div>

                <InputComponent
                    type='text'
                    label='Причина (необовʼязково)'
                    value={reason}
                    onChange={(e: any) => setReason(e.target.value)}
                    placeholder='Напр. планова відпустка'
                />

                {canManage && (
                    <p className='text-sm text-amber-700 bg-amber-50 rounded-xl p-3'>
                        У вас є право керувати графіком, тож відсутність буде
                        оформлено одразу погодженою, а планові зміни на ці дні —
                        знято з графіка.
                    </p>
                )}

                <div className='flex gap-3 justify-end'>
                    <button
                        type='button'
                        onClick={onClose}
                        className='rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm font-medium'
                    >
                        Відміна
                    </button>
                    <button
                        type='submit'
                        disabled={create.isPending}
                        className='rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50'
                    >
                        {create.isPending ? 'Надсилання…' : 'Подати'}
                    </button>
                </div>
            </form>
        </MyModal>
    )
}

export default AbsenceModal
