'use client'

import React, { useEffect, useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import MyModal from '@/app/components/Modal'
import InputComponent from '@/app/components/forms/InputComponent'
import { IDepartment } from '@/interface/IDepartment'
import { useCreateDepartmentMutation } from '@/hooks/department/use-create-department.mutation'
import { useUpdateDepartmentMutation } from '@/hooks/department/use-update-department.mutation'
import { useDeleteDepartmentMutation } from '@/hooks/department/use-delete-department.mutation'
import { useGetUserListMutation } from '@/hooks/user/get.user.list.mutation'
import { departmentService } from '@/service/department.service'
import { FaTrash } from 'react-icons/fa'
import { toast } from 'sonner'
import Avatar from '@/app/components/user/Avatar'
import DepartmentTelegramLink from './Department.TelegramLink'

interface DepartmentModalProps {
    isOpen: boolean
    onClose: () => void
    department: IDepartment | null
    onUpdate: () => void
}

const buildStaffing = (weekday: number, weekend: number) => ({
    '1': weekday,
    '2': weekday,
    '3': weekday,
    '4': weekday,
    '5': weekday,
    '6': weekend,
    '7': weekend,
})

const DepartmentModal: React.FC<DepartmentModalProps> = ({
                                                             isOpen,
                                                             onClose,
                                                             department,
                                                             onUpdate,
                                                         }) => {
    const isEditMode = !!department

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<IDepartment>({
        defaultValues: department || {},
    })

    // Штат: одне число на будні, одне на вихідні (розкладається в усі 7 днів)
    const [weekdayStaff, setWeekdayStaff] = useState<number>(
        department?.staffingByWeekday?.['1'] ?? 1
    )
    const [weekendStaff, setWeekendStaff] = useState<number>(
        department?.staffingByWeekday?.['6'] ?? 1
    )

    // Членство команди (лише в режимі редагування)
    const { mutate: fetchUsers, users } = useGetUserListMutation()
    const [memberIds, setMemberIds] = useState<Set<number>>(new Set())

    useEffect(() => {
        if (!isEditMode || !department) return
        fetchUsers()
        departmentService
            .getMembers(department.id)
            .then((res) => setMemberIds(new Set(res.data.map((m) => m.id))))
            .catch(() => {})
    }, [isEditMode, department, fetchUsers])

    const toggleMember = (id: number) => {
        setMemberIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const { mutate: createDepartment, isPending: isCreating } =
        useCreateDepartmentMutation(() => {
            onUpdate()
            onClose()
        })

    const { mutate: updateDepartment, isPending: isUpdating } =
        useUpdateDepartmentMutation(department?.id || 0, () => {
            onUpdate()
            onClose()
        })

    const { mutate: deleteDepartment, isPending: isDeleting } =
        useDeleteDepartmentMutation(department?.id || 0, () => {
            onUpdate()
            onClose()
        })

    const onSubmit: SubmitHandler<IDepartment> = async (data) => {
        const dataToSend: any = { ...data }

        dataToSend.latitude =
            data.latitude === undefined || (data.latitude as any) === ''
                ? null
                : parseFloat(data.latitude as any)
        dataToSend.longitude =
            data.longitude === undefined || (data.longitude as any) === ''
                ? null
                : parseFloat(data.longitude as any)

        dataToSend.staffingByWeekday = buildStaffing(
            Number(weekdayStaff),
            Number(weekendStaff)
        )

        if (isEditMode && department) {
            // Членство зберігаємо окремим запитом (m2m)
            try {
                await departmentService.setMembers(department.id, [...memberIds])
            } catch {
                toast.error('Не вдалося зберегти склад команди')
            }
            updateDepartment(dataToSend)
        } else {
            createDepartment(dataToSend)
        }
    }

    return (
        <MyModal isOpen={isOpen} onClose={onClose}>
            <div className='flex flex-col gap-7 w-full'>
                <form
                    className='w-full flex flex-col gap-7'
                    onSubmit={handleSubmit(onSubmit)}
                >
                    <div className='flex flex-row items-center justify-between'>
                        <h1 className='text-2xl font-semibold text-black'>
                            {isEditMode ? 'Редагування відділення' : 'Створення відділення'}
                        </h1>
                        <div className='flex flex-row gap-2'>
                            <button
                                onClick={onClose}
                                type='button'
                                className='rounded-2xl border-2 border-gray-200 px-4 py-2.5 text-black text-base font-medium hover:opacity-95 hover:shadow-sm'
                            >
                                Відміна
                            </button>
                            <button
                                type='submit'
                                className='rounded-2xl border-2 border-gray-200 px-4 py-2.5 bg-primary text-white text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-40'
                                disabled={isUpdating || isCreating}
                            >
                                Зберегти
                            </button>
                        </div>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
                        <InputComponent
                            {...register('name', { required: 'Це поле є обов`язковим' })}
                            errors={errors.name?.message}
                            label='Назва'
                            placeholder='Назва відділення'
                        />
                        <InputComponent
                            {...register('address')}
                            label='Адреса'
                            placeholder='Адреса'
                        />
                        <InputComponent
                            {...register('weekdaysOpeningTime', { required: 'Це поле є обов`язковим' })}
                            errors={errors.weekdaysOpeningTime?.message}
                            label='Відкриття (будні)'
                            type='time'
                        />
                        <InputComponent
                            {...register('weekdaysClosingTime', { required: 'Це поле є обов`язковим' })}
                            errors={errors.weekdaysClosingTime?.message}
                            label='Закриття (будні)'
                            type='time'
                        />
                        <InputComponent
                            {...register('weekendsOpeningTime', { required: 'Це поле є обов`язковим' })}
                            errors={errors.weekendsOpeningTime?.message}
                            label='Відкриття (вихідні)'
                            type='time'
                        />
                        <InputComponent
                            {...register('weekendsClosingTime', { required: 'Це поле є обов`язковим' })}
                            errors={errors.weekendsClosingTime?.message}
                            label='Закриття (вихідні)'
                            type='time'
                        />
                        <InputComponent
                            {...register('latitude')}
                            label='Широта'
                            placeholder='50.4501'
                            type='number'
                        />
                        <InputComponent
                            {...register('longitude')}
                            label='Довгота'
                            placeholder='30.5234'
                            type='number'
                        />
                    </div>

                    {/* Потрібний штат для автогенерації графіка */}
                    <div>
                        <h2 className='text-lg font-semibold text-black mb-1'>
                            Потрібний штат на зміні
                        </h2>
                        <p className='text-sm text-gray-500 mb-3'>
                            Скільки співробітників має працювати одночасно —
                            використовується для автоматичної генерації графіка.
                        </p>
                        <div className='grid grid-cols-2 gap-5'>
                            <div className='flex flex-col gap-1'>
                                <label className='text-sm text-gray-600'>Будні (Пн–Пт)</label>
                                <input
                                    type='number'
                                    min={0}
                                    max={50}
                                    value={weekdayStaff}
                                    onChange={(e) => setWeekdayStaff(Number(e.target.value))}
                                    className='rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:border-primary'
                                />
                            </div>
                            <div className='flex flex-col gap-1'>
                                <label className='text-sm text-gray-600'>Вихідні (Сб–Нд)</label>
                                <input
                                    type='number'
                                    min={0}
                                    max={50}
                                    value={weekendStaff}
                                    onChange={(e) => setWeekendStaff(Number(e.target.value))}
                                    className='rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:border-primary'
                                />
                            </div>
                        </div>
                    </div>

                    {/* Склад команди — джерело кандидатів для генерації */}
                    {isEditMode && (
                        <div>
                            <h2 className='text-lg font-semibold text-black mb-1'>
                                Склад команди
                            </h2>
                            <p className='text-sm text-gray-500 mb-3'>
                                Хто належить до цього відділення. Генератор розподіляє
                                зміни лише між цими співробітниками.
                            </p>
                            <div className='max-h-52 overflow-y-auto custom-scrollbar rounded-xl border border-gray-200 divide-y divide-gray-100'>
                                {(users ?? []).map((u) => (
                                    <label
                                        key={u.id}
                                        className='flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50'
                                    >
                                        <input
                                            type='checkbox'
                                            checked={memberIds.has(u.id)}
                                            onChange={() => toggleMember(u.id)}
                                            className='h-4 w-4 accent-primary'
                                        />
                                        <Avatar avatar={u.avatar || undefined} size={2.25} />
                                        <span className='text-sm text-gray-800'>
                                            {u.firstName} {u.lastName}
                                        </span>
                                        <span className='text-xs text-gray-400 ml-auto'>
                                            {u.role}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {isEditMode && department && (
                        <DepartmentTelegramLink
                            departmentId={department.id}
                            departmentName={department.name}
                        />
                    )}

                    {isEditMode && (
                        <div className='flex justify-start'>
                            <button
                                type='button'
                                onClick={() => deleteDepartment()}
                                disabled={isDeleting}
                                className='flex items-center gap-2 text-red-500 hover:text-red-700 font-medium'
                            >
                                <FaTrash />
                                {isDeleting ? 'Видалення...' : 'Видалити відділення'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </MyModal>
    )
}

export default DepartmentModal
