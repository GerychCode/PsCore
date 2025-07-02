import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { FaImage } from 'react-icons/fa'
import Avatar from '@/app/components/user/Avatar'
import { IoMdPerson } from 'react-icons/io'
import InputComponent from '@/app/components/forms/InputComponent'
import MyModal from '@/app/components/Modal'
import { SubmitHandler, useForm } from 'react-hook-form'
import { IUserRegister } from '@/interface/IUserAuth'
import { userStore } from '@/store/user.store'
import { IUserUpdate } from '@/interface/IUserUpdate'
import { userUpdate } from '@/hooks/user.update.mutation'



const ProfileModal = ({ isModalOpen, setIsModalOpen }: any) => {
  const user = userStore((state) => state.user);
  const [changedFields, setChangedFields] = useState<Partial<IUserUpdate>>({});
  const [isProfileFieldsUpdated, setIsProfileFieldsUpdated] = useState(false);

  const initialValues: IUserUpdate = {
    firstName: user?.firstName ? user?.firstName : "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    dateOfBirth: user?.dateOfBirth || "",
  };
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<IUserUpdate>({
    defaultValues: initialValues,
  });

  const {mutate, isPending} = userUpdate(changedFields)
  const onSubmit = async () => {
    if (Object.keys(changedFields).length === 0) return;
    await mutate()
  };

  useEffect(() => {
    if (user) {
      reset(initialValues);
    }
  }, [user, reset]);

  useEffect(() => {
    const subscription = watch((currentValues) => {
      const updatedFields: Partial<IUserUpdate> = {};

      Object.keys(initialValues).forEach((key) => {
        const k = key as keyof IUserUpdate;
        const current = currentValues[k];
        const initial = initialValues[k];

        if (current !== initial) {
          updatedFields[k] = current;
        }
      });

      setChangedFields(updatedFields);
      setIsProfileFieldsUpdated(Object.keys(updatedFields).length > 0);
    });

    return () => subscription.unsubscribe();
  }, [watch, initialValues]);

  return (


    <MyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
      {
        <div className="flex gap-7 flex-col w-full">
          <form
            className="w-full flex flex-col gap-5 flex gap-7 flex-col"
            onSubmit={handleSubmit(onSubmit)}
          >
          <div className="flex flex-row item-center justify-between gap-16">
            <div className="flex flex-col">
              <h1 className="text-2xl font-semibold text-black">
                Редагування профілю
              </h1>
              {user?.createdAt && (
                <h3 className="text-sm text-secondary">
                  Останнє редагування:{" "}
                  {format(new Date(user?.updatedAt), "dd MMM yyyy", {
                    locale: uk,
                  })}
                </h3>
              )}
            </div>
            <div className="flex flex-row gap-1">
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  reset(initialValues)
                }}
                type="reset"
                className="rounded-2xl border-2 border-gray-200 p-2.5 text-black text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-50"
              >
                Відміна
              </button>
              <button
                type="submit"
                className="rounded-2xl border-2 border-gray-200 p-2.5 bg-primary text-white text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-20"
                disabled={!isProfileFieldsUpdated}
              >
                Зберегти
              </button>
            </div>
          </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-row gap-1.5 items-center">
                <FaImage className="text-2xl text-primary" />
                <h2 className="text-md font-medium text-black">
                  Аватарка профілю
                </h2>
              </div>
              <div className="flex flex-row gap-3 items-center">
                <Avatar size={6} />
                <div className="flex flex-row gap-3">
                  <button
                    className="rounded-2xl border-2 border-gray-200 p-2.5 bg-primary text-white text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-20"
                    type="button"
                  >
                    Обрати зображення
                  </button>
                  <button
                    className="rounded-2xl border-2 border-gray-200 p-2.5 text-black text-base font-medium hover:opacity-95 hover:shadow-sm disabled:opacity-50"
                    type="button"
                  >
                    Видалити Аватарку
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-row gap-1.5 items-center">
                <IoMdPerson className="text-2xl text-primary"></IoMdPerson>
                <h2 className="text-md font-medium text-black">
                  Аватарка профілю
                </h2>
              </div>
              <div className="flex flex-row gap-5 items-center justify-between">
                <InputComponent
                  {...register("firstName")}
                  errors={errors.firstName?.message}
                  type="text"
                  label="Ім`я"
                  defaultValue={watch('firstName')}
                  placeholder="Ім`я"
                />
                <InputComponent
                  {...register("lastName")}
                  errors={errors.lastName?.message}
                  type="text"
                  label="Прізвище"
                  defaultValue={watch('lastName')}
                  placeholder="Прізвище"
                />
              </div>
              <InputComponent
                {...register("email")}
                errors={errors.email?.message}
                type="text"
                label="Пошта"
                defaultValue={watch('email')}
                placeholder="Пошта"
              />
              <InputComponent
                {...register("dateOfBirth")}
                name="dateOfBirth"
                type="date"
                label="Дата народження"
                defaultValue={watch('dateOfBirth')}
                placeholder="Дата народження"
                errors={errors.dateOfBirth?.message}
                onSelect={(date: any) => {
                  setValue("dateOfBirth", date, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
              />
            </div>
          </form>
        </div>
      }
    </MyModal>
  )
}

export default ProfileModal