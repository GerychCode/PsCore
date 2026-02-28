'use client'

import React from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { FaCalendarDay, FaClock, FaTrash, FaUser } from 'react-icons/fa'
import MyModal from '@/app/components/Modal'
import InputComponent from '@/app/components/forms/InputComponent'
import {
  IWorkSchedule,
  IWorkScheduleCreate,
  IWorkScheduleUpdate,
} from '@/interface/IWorkSchedule'
import { useUpdateWorkScheduleMutation } from '@/hooks/work-schedule/update.work-schedule.mutation'
import { useDeleteWorkScheduleMutation } from '@/hooks/work-schedule/delete.work-schedule.mutation'
import { useCreateWorkScheduleMutation } from '@/hooks/work-schedule/create.work-schedule.mutation'
import { userStore } from '@/store/user.store'
import { IUser } from '@/interface/IUser'

interface ScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: IWorkSchedule | Partial<IWorkScheduleCreate>
  onUpdate: () => void
  users?: IUser[]
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  schedule,
  onUpdate,
  users = [],
}) => {
  const isAdmin = userStore((state) => state.isAdmin)
  const isEditMode = 'id' in schedule

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty, errors },
  } = useForm<IWorkScheduleUpdate | IWorkScheduleCreate>({
    defaultValues: {
      ...schedule,
      // @ts-ignore
      userId: schedule.userId,
      date: schedule.date ? format(new Date(schedule.date), 'yyyy-MM-dd') : '',
    },
  })

  const { mutate: createSchedule, isPending: isCreating } =
    useCreateWorkScheduleMutation(() => {
      onUpdate()
      onClose()
    })

  const { mutate: updateSchedule, isPending: isUpdating } =
    useUpdateWorkScheduleMutation(
      isEditMode ? (schedule as IWorkSchedule).id : 0,
      () => {
        onUpdate()
        onClose()
      }
    )

  const { mutate: deleteSchedule, isPending: isDeleting } =
    useDeleteWorkScheduleMutation(
      isEditMode ? (schedule as IWorkSchedule).id : 0,
      () => {
        onUpdate()
        onClose()
      }
    )

  const onSubmit: SubmitHandler<IWorkScheduleUpdate | IWorkScheduleCreate> = (
    data: any
  ) => {
    const dataToSend = {
      ...data,
      userId: Number(data.userId),
      date: data.date ? format(new Date(data.date), 'yyyy-MM-dd') : undefined,
    }

    if (isEditMode) {
      updateSchedule(dataToSend)
    } else {
      createSchedule(dataToSend as IWorkScheduleCreate)
    }
  }

  const isDayOff = watch('isDayOff')

  return (
    <MyModal isOpen={isOpen} onClose={onClose}>
      <div className='flex flex-col gap-7 w-full'>
        <form
          className='w-full flex flex-col gap-7'
          onSubmit={handleSubmit(onSubmit)}
        >
          {/* Header */}
          <div className='flex flex-row items-center justify-between'>
            <div className='flex flex-col'>
              <h1 className='text-2xl font-semibold text-black'>
                {isEditMode ? 'Редагування зміни' : 'Створення зміни'}
              </h1>
              <h3 className='text-sm text-secondary'>
                {'date' in schedule && schedule.date
                  ? format(new Date(schedule.date), 'dd MMMM yyyy', {
                      locale: uk,
                    })
                  : 'Нова зміна'}
              </h3>
            </div>
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

          {/* Body */}
          <div className='flex flex-col gap-5'>
            {/* User Selection (Admin Only) */}
            {isAdmin && (
              <div className='flex flex-col gap-3'>
                <div className='flex flex-row gap-2 items-center'>
                  <FaUser className='text-xl text-primary' />
                  <h2 className='text-md font-medium text-black'>
                    Співробітник
                  </h2>
                </div>
                <select
                  {...register('userId', { required: 'Оберіть співробітника' })}
                  className='h-12 w-full rounded-2xl border-2 border-gray-200 p-3 bg-white outline-none focus:border-primary transition-colors'
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date and Status Section */}
            <div className='flex flex-col gap-3'>
              <div className='flex flex-row gap-2 items-center'>
                <FaCalendarDay className='text-xl text-primary' />
                <h2 className='text-md font-medium text-black'>
                  Дата та статус
                </h2>
              </div>
              {!isEditMode && (
                <InputComponent
                  {...register('date')}
                  type='date'
                  label='Дата'
                  defaultValue={watch('date')}
                  onSelect={(date: any) =>
                    setValue('date', date, { shouldDirty: true })
                  }
                />
              )}
              <div className='flex items-center gap-3 mt-2'>
                <input
                  id='isDayOff'
                  type='checkbox'
                  className='h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary'
                  {...register('isDayOff')}
                />
                <label htmlFor='isDayOff' className='font-medium text-gray-700'>
                  Це вихідний день
                </label>
              </div>
            </div>

            {/* Time Section */}
            {!isDayOff && (
              <div className='flex flex-col gap-3'>
                <div className='flex flex-row gap-2 items-center'>
                  <FaClock className='text-xl text-primary' />
                  <h2 className='text-md font-medium text-black'>
                    Робочі години
                  </h2>
                </div>
                <div className='flex flex-row gap-5 items-center justify-between'>
                  <InputComponent
                    {...register('startedAt')}
                    type='time'
                    label='Час початку'
                  />
                  <InputComponent
                    {...register('endTime')}
                    type='time'
                    label='Час закінчення'
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {isEditMode && (
            <div className='flex justify-start'>
              <button
                type='button'
                onClick={() => deleteSchedule()}
                disabled={isDeleting}
                className='flex items-center gap-2 text-red-500 hover:text-red-700 font-medium'
              >
                <FaTrash />
                {isDeleting ? 'Видалення...' : 'Видалити зміну'}
              </button>
            </div>
          )}
        </form>
      </div>
    </MyModal>
  )
}

export default ScheduleModal
