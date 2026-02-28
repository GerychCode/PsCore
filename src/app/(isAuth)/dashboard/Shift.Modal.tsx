'use client'

import React, { useEffect } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { format } from 'date-fns'
import { FaTrash, FaUser, FaBuilding } from 'react-icons/fa'
import MyModal from '@/app/components/Modal'
import InputComponent from '@/app/components/forms/InputComponent'
import { IShift, ITag } from '@/interface/IShift'
import { IUser } from '@/interface/IUser'
import { IDepartment } from '@/interface/IDepartment'
import {
  useCreateShiftMutation,
  useUpdateShiftMutation,
  useDeleteShiftMutation,
} from '@/hooks/shift/use-shifts.mutations'
import { IShiftCreate, IShiftUpdate } from '@/service/shift.service'
import { userStore } from '@/store/user.store'

interface ShiftModalProps {
  isOpen: boolean
  onClose: () => void
  shift: IShift | null
  departments: IDepartment[]
  users: IUser[]
  availableTags?: ITag[]
}

const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  shift,
  departments,
  users,
  availableTags = [],
}) => {
  const isAdmin = userStore((state) => state.isAdmin)
  const isEditMode = !!shift
  const user = userStore((state) => state.user)

  const { register, handleSubmit, setValue, watch, reset } = useForm<
    IShiftCreate & { status?: string; tagIds?: number[] }
  >()

  useEffect(() => {
    if (shift) {
      reset({
        departmentId: shift.departmentId,
        date: format(new Date(shift.date), 'yyyy-MM-dd'),
        startedAt: shift.startedAt,
        endTime: shift.endTime,
        // @ts-ignore
        userId: shift.userId,
        status: shift.status,
        tagIds: shift.tags?.map((t) => t.id) || [],
      })
    } else {
      reset({
        // @ts-ignore
        userId: user?.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        startedAt: '09:00',
        endTime: '18:00',
        tagIds: [],
      })
    }
  }, [shift, user, reset, isOpen])

  const { mutate: createShift, isPending: isCreating } =
    useCreateShiftMutation(onClose)
  const { mutate: updateShift, isPending: isUpdating } = useUpdateShiftMutation(
    shift?.id || 0,
    onClose
  )
  const { mutate: deleteShift } = useDeleteShiftMutation(onClose)

  const onSubmit: SubmitHandler<
    IShiftCreate & { status?: string; tagIds?: number[] }
  > = (data) => {
    const payload: any = {
      ...data,
      userId: Number(data.userId),
      departmentId: Number(data.departmentId),
      tagIds: data.tagIds ? data.tagIds.map(Number) : [],
    }

    if (isEditMode && shift) {
      updateShift(payload as IShiftUpdate)
    } else {
      createShift(payload as IShiftCreate)
    }
  }

  return (
    <MyModal isOpen={isOpen} onClose={onClose}>
      <div className='flex flex-col gap-7 w-full min-w-[350px]'>
        <form
          className='w-full flex flex-col gap-7'
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className='flex flex-row items-center justify-between'>
            <div className='flex flex-col'>
              <h1 className='text-2xl font-semibold text-black'>
                {isEditMode ? 'Редагування зміни' : 'Нова зміна'}
              </h1>
              {isEditMode && (
                <span
                  className={`text-sm font-bold ${
                    shift?.status === 'APPROVED'
                      ? 'text-green-600'
                      : shift?.status === 'REJECTED'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                  }`}
                >
                  Статус: {shift?.status}
                </span>
              )}
            </div>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={onClose}
                className='rounded-2xl border-2 border-gray-200 px-4 py-2 text-black hover:opacity-75'
              >
                Скасувати
              </button>
              <button
                type='submit'
                disabled={isCreating || isUpdating}
                className='rounded-2xl bg-primary text-white px-4 py-2 hover:opacity-90 disabled:opacity-50'
              >
                Зберегти
              </button>
            </div>
          </div>

          <div className='flex flex-col gap-4'>
            {isAdmin && (
              <div className='flex flex-col gap-2'>
                <label className='flex items-center gap-2 font-medium'>
                  <FaUser className='text-primary' /> Співробітник
                </label>
                <select
                  {...register('userId')}
                  className='h-12 w-full rounded-2xl border-2 border-gray-200 p-3 bg-white outline-none focus:border-primary'
                  disabled={isEditMode}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className='flex flex-col gap-2'>
              <label className='flex items-center gap-2 font-medium'>
                <FaBuilding className='text-primary' /> Відділення
              </label>
              <select
                {...register('departmentId')}
                className='h-12 w-full rounded-2xl border-2 border-gray-200 p-3 bg-white outline-none focus:border-primary'
              >
                <option value=''>Оберіть відділення</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <InputComponent
              {...register('date')}
              type='date'
              label='Дата'
              defaultValue={watch('date')}
              onSelect={(d: any) => setValue('date', d)}
            />

            <div className='flex gap-4'>
              <InputComponent
                {...register('startedAt')}
                type='time'
                label='Початок'
              />
              <InputComponent
                {...register('endTime')}
                type='time'
                label='Кінець'
              />
            </div>

            {isAdmin && isEditMode && (
              <div className='flex flex-col gap-2'>
                <label className='font-medium'>Статус зміни</label>
                <select
                  {...register('status')}
                  className='h-12 w-full rounded-2xl border-2 border-gray-200 p-3 bg-white'
                >
                  <option value='PENDING'>На розгляді</option>
                  <option value='APPROVED'>Підтверджено</option>
                  <option value='REJECTED'>Відхилено</option>
                </select>
              </div>
            )}

            {isAdmin && isEditMode && availableTags.length > 0 && (
              <div className='flex flex-col gap-2'>
                <label className='font-medium'>Теги (маркери)</label>
                <div className='flex flex-wrap gap-2 p-3 border-2 border-gray-200 rounded-2xl'>
                  {availableTags.map((tag) => (
                    <label
                      key={tag.id}
                      className='flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-xl hover:bg-gray-100'
                    >
                      <input
                        type='checkbox'
                        value={tag.id}
                        {...register('tagIds')}
                        className='w-4 h-4 text-primary rounded'
                      />
                      <span
                        className={`text-sm font-medium ${
                          tag.severity === 3
                            ? 'text-red-600'
                            : tag.severity === 2
                              ? 'text-yellow-600'
                              : 'text-green-600'
                        }`}
                      >
                        {tag.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isEditMode && (
            <button
              type='button'
              onClick={() => {
                if (shift) deleteShift(shift.id)
              }}
              className='flex items-center gap-2 text-red-500 font-medium hover:text-red-700 w-fit'
            >
              <FaTrash /> Видалити зміну
            </button>
          )}
        </form>
      </div>
    </MyModal>
  )
}

export default ShiftModal
