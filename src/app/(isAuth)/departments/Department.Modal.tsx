'use client'

import React from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import MyModal from '@/app/components/Modal'
import InputComponent from '@/app/components/forms/InputComponent'
import { IDepartment } from '@/interface/IDepartment'
import { useCreateDepartmentMutation } from '@/hooks/department/use-create-department.mutation'
import { useUpdateDepartmentMutation } from '@/hooks/department/use-update-department.mutation'
import { useDeleteDepartmentMutation } from '@/hooks/department/use-delete-department.mutation'
import { FaTrash } from 'react-icons/fa'

interface DepartmentModalProps {
    isOpen: boolean
    onClose: () => void
    department: IDepartment | null
    onUpdate: () => void
}

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
        formState: { errors, isDirty },
    } = useForm<IDepartment>({
        defaultValues: department || {},
    })

    const { mutate: createDepartment, isPending: isCreating } = useCreateDepartmentMutation(() => {
        onUpdate()
        onClose()
    })

    const { mutate: updateDepartment, isPending: isUpdating } = useUpdateDepartmentMutation(department?.id || 0, () => {
        onUpdate()
        onClose()
    })

    const { mutate: deleteDepartment, isPending: isDeleting } = useDeleteDepartmentMutation(department?.id || 0, () => {
        onUpdate()
        onClose()
    })

    const onSubmit: SubmitHandler<IDepartment> = (data) => {
        const dataToSend = { ...data };

        // Перетворюємо порожні рядки на null, щоб уникнути помилок валідації на бекенді
        if (dataToSend.latitude === '' || dataToSend.latitude === undefined) {
            (dataToSend.latitude as any) = null;
        } else {
            dataToSend.latitude = parseFloat(dataToSend.latitude as any);
        }

        if (dataToSend.longitude === '' || dataToSend.longitude === undefined) {
            (dataToSend.longitude as any) = null;
        } else {
            dataToSend.longitude = parseFloat(dataToSend.longitude as any);
        }

        if (isEditMode) {
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
                                disabled={!isDirty || isUpdating || isCreating}
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