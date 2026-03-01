import React, { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { FaImage } from 'react-icons/fa'
import Avatar from '@/app/components/user/Avatar'
import { IoMdPerson } from 'react-icons/io'
import InputComponent from '@/app/components/forms/InputComponent'
import MyModal from '@/app/components/Modal'
import { useForm } from 'react-hook-form'
import { userStore } from '@/store/user.store'
import { IUserUpdate } from '@/interface/IUserUpdate'
import { userUpdate, userUpdateAvatar } from '@/hooks/user/user.update.mutation'
import { useGetUserMutation } from '@/hooks/user/get.user.mutation'
import { toast } from 'sonner'

const ProfileModal = ({ isModalOpen, setIsModalOpen }: any) => {
  const user = userStore((state) => state.user)
  const [avatarFile, setAvatarFile] = useState<File>()
  const [changedFields, setChangedFields] = useState<Partial<IUserUpdate>>({})
  const [isProfileFieldsUpdated, setIsProfileFieldsUpdated] = useState(false)

  const initialValues = useMemo<IUserUpdate>(
    () => ({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      dateOfBirth: user?.dateOfBirth || '',
      phone: user?.phone || '',
      address: user?.address || '',
      avatar: user?.avatar || null,
    }),
    [user]
  )

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<IUserUpdate>({
    defaultValues: initialValues,
  })

  const { mutateAsync, isPending: isProfileUpdating } =
    userUpdate(changedFields)
  const { mutateAsync: updateAvatarMutation, isPending: isAvatarUpdating } =
    userUpdateAvatar()
  const { mutate: getUser } = useGetUserMutation()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const onSubmit = async () => {
    if (!avatarFile && Object.keys(changedFields).length === 0) {
      toast.error('Ви не змінили жодного поля для оновлення.')
      return
    }

    try {
      let avatarUpdated = false
      let profileUpdated = false

      if (avatarFile) {
        const formData = new FormData()
        formData.append('avatar', avatarFile)
        await updateAvatarMutation(formData)
        avatarUpdated = true
      }

      if (Object.keys(changedFields).length > 0) {
        await mutateAsync()
        profileUpdated = true
      }

      if (avatarUpdated || profileUpdated) {
        toast.success('Профіль успішно оновлено!')
      }

      setIsProfileFieldsUpdated(false)
      setAvatarFile(undefined)
      setPreviewUrl(null)
      setIsModalOpen(false)
    } catch (error: any) {
      if (error.response?.data?.message === 'Ви не обновили жодної строки!') {
        toast.error('Дані, які ви надіслали, не відрізняються від поточних.')
      } else {
        toast.error('Сталася помилка при оновленні профілю.')
        console.error('Profile update failed:', error)
      }
    } finally {
      getUser()
    }
  }

  useEffect(() => {
    if (user) {
      reset(initialValues)
    }
  }, [user, reset, initialValues])

  useEffect(() => {
    const subscription = watch((currentValues) => {
      const updatedFields: Partial<IUserUpdate> = {}

      Object.keys(initialValues).forEach((key) => {
        const k = key as keyof IUserUpdate
        const current = currentValues[k]
        const initial = initialValues[k]

        if ((current || '') !== (initial || '')) {
          updatedFields[k] = current
        }
      })

      setChangedFields(updatedFields)
    })

    return () => subscription.unsubscribe()
  }, [watch, initialValues])

  useEffect(() => {
    setIsProfileFieldsUpdated(
      Object.keys(changedFields).length > 0 || !!avatarFile
    )
  }, [changedFields, avatarFile])

  return (
    <MyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
      <div className='flex flex-col w-full max-h-[85vh] overflow-y-auto pr-2 pb-2 custom-scrollbar'>
        <form
          className='w-full flex flex-col gap-5'
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className='flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-16'>
            <div className='flex flex-col'>
              <h1 className='text-2xl font-semibold text-black'>
                Редагування профілю
              </h1>
              {user?.createdAt && (
                <h3 className='text-sm text-secondary'>
                  Останнє редагування:{' '}
                  {format(new Date(user?.updatedAt), 'dd MMM yyyy', {
                    locale: uk,
                  })}
                </h3>
              )}
            </div>
            <div className='flex flex-row gap-2 w-full md:w-auto justify-end'>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setPreviewUrl(null)
                  reset(initialValues)
                  setAvatarFile(undefined)
                }}
                type='reset'
                className='rounded-2xl border-2 border-gray-200 p-2 text-black text-sm md:text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-50'
              >
                Відміна
              </button>
              <button
                type='submit'
                className='rounded-2xl border-2 border-gray-200 p-2 bg-primary text-white text-sm md:text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-50'
                disabled={
                  !isProfileFieldsUpdated ||
                  isProfileUpdating ||
                  isAvatarUpdating
                }
              >
                Зберегти
              </button>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <div className='flex flex-row gap-1.5 items-center'>
              <FaImage className='text-2xl text-primary' />
              <h2 className='text-md font-medium text-black'>
                Аватарка профілю
              </h2>
            </div>
            {/* Адаптація кнопок аватарки для мобільних */}
            <div className='flex flex-col sm:flex-row gap-3 items-center sm:items-start'>
              <Avatar
                avatar={previewUrl || user?.avatar}
                size={6}
                preview={!!previewUrl}
              />
              <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
                <label
                  htmlFor='avatar'
                  className='inline-block cursor-pointer text-center rounded-2xl border-2 border-gray-200 p-2 bg-primary text-white text-sm md:text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-20'
                >
                  Обрати зображення
                </label>
                <input
                  className='hidden'
                  type='file'
                  id='avatar'
                  name='avatar'
                  accept='image/png, image/jpeg'
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setAvatarFile(file)
                      setPreviewUrl(URL.createObjectURL(file))
                    }
                  }}
                />
                <button
                  className='rounded-2xl border-2 border-gray-200 p-2 text-black text-sm md:text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-50 w-full sm:w-auto'
                  type='button'
                >
                  Видалити
                </button>
              </div>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <div className='flex flex-row gap-1.5 items-center'>
              <IoMdPerson className='text-2xl text-primary'></IoMdPerson>
              <h2 className='text-md font-medium text-black'>Дані профілю</h2>
            </div>
            {/* Адаптація полів імені та прізвища */}
            <div className='flex flex-col md:flex-row gap-5 items-center justify-between'>
              <InputComponent
                {...register('firstName')}
                errors={errors.firstName?.message}
                type='text'
                label='Ім`я'
                defaultValue={watch('firstName')}
                placeholder='Ім`я'
              />
              <InputComponent
                {...register('lastName')}
                errors={errors.lastName?.message}
                type='text'
                label='Прізвище'
                defaultValue={watch('lastName')}
                placeholder='Прізвище'
              />
            </div>
            <InputComponent
              {...register('email')}
              errors={errors.email?.message}
              type='text'
              label='Пошта'
              defaultValue={watch('email')}
              placeholder='Пошта'
            />
            <InputComponent
              {...register('phone')}
              errors={errors.phone?.message}
              type='tel'
              label='Номер телефону'
              defaultValue={watch('phone')}
              placeholder='+380...'
            />
            <InputComponent
              {...register('address')}
              errors={errors.address?.message}
              type='text'
              label='Адреса проживання'
              defaultValue={watch('address')}
              placeholder='Введіть адресу'
            />
            <InputComponent
              {...register('dateOfBirth')}
              name='dateOfBirth'
              type='date'
              label='Дата народження'
              defaultValue={watch('dateOfBirth')}
              placeholder='Дата народження'
              errors={errors.dateOfBirth?.message}
              calendarPlacement='top'
              onSelect={(date: any) => {
                setValue('dateOfBirth', date, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })
              }}
            />
          </div>
        </form>
      </div>
    </MyModal>
  )
}

export default ProfileModal
