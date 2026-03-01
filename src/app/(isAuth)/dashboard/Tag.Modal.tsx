'use client'

import React from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { FaTrash } from 'react-icons/fa'
import MyModal from '@/app/components/Modal'
import { ITagCreate } from '@/interface/ITag'
import InputComponent from '@/app/components/forms/InputComponent'
import { useCreateTagMutation } from '@/hooks/shift.tag/create.tag.mutation'
import { useDeleteTagMutation } from '@/hooks/shift.tag/delete.tag.mutation'
import { useGetTagsQuery } from '@/hooks/shift.tag/get.tags.query'

interface TagModalProps {
  isOpen: boolean
  onClose: () => void
}

const TagModal: React.FC<TagModalProps> = ({ isOpen, onClose }) => {
  const { data: tags, isLoading } = useGetTagsQuery()

  const { register, handleSubmit, reset, setError } = useForm<ITagCreate>({
    defaultValues: { severity: 1 },
  })

  // Використовуємо наші мутації
  const { mutate: createTag, isPending: isCreating } = useCreateTagMutation(
    reset,
    setError,
    () => {} // Функція після успіху (форма сама очиститься завдяки reset)
  )

  const { mutate: deleteTag } = useDeleteTagMutation()

  const onSubmit: SubmitHandler<ITagCreate> = (data) => {
    createTag({
      ...data,
      severity: Number(data.severity),
    })
  }

  return (
    <MyModal isOpen={isOpen} onClose={onClose}>
      <div className='flex flex-col gap-6 w-full min-w-[350px] sm:min-w-[500px]'>
        <div className='flex flex-row items-center justify-between'>
          <h1 className='text-2xl font-semibold text-black'>
            Управління тегами
          </h1>
          <button
            type='button'
            onClick={onClose}
            className='rounded-2xl border-2 border-gray-200 px-4 py-2 text-black hover:opacity-75'
          >
            Закрити
          </button>
        </div>

        {/* Форма створення нового тегу */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className='flex flex-col gap-4 p-4 border-2 border-gray-100 rounded-2xl bg-gray-50'
        >
          <h2 className='text-lg font-medium'>Створити новий тег</h2>
          <div className='flex gap-4 items-end'>
            <div className='flex-1'>
              <InputComponent
                {...register('name', { required: 'Назва обовʼязкова' })}
                type='text'
                label='Назва тегу'
                placeholder='Наприклад: Запізнення'
              />
            </div>
            <div className='w-32'>
              <label className='block mb-2 font-medium text-sm text-gray-700'>
                Важливість
              </label>
              <select
                {...register('severity')}
                className='h-[50px] w-full rounded-2xl border-2 border-gray-200 px-3 bg-white outline-none focus:border-primary'
              >
                <option value={1}>Низька (1)</option>
                <option value={2}>Середня (2)</option>
                <option value={3}>Висока (3)</option>
              </select>
            </div>
          </div>
          <button
            type='submit'
            disabled={isCreating}
            className='rounded-2xl bg-primary text-white px-4 py-3 hover:opacity-90 disabled:opacity-50 mt-2 font-medium'
          >
            {isCreating ? 'Створення...' : 'Додати тег'}
          </button>
        </form>

        {/* Список існуючих тегів */}
        <div className='flex flex-col gap-3'>
          <h2 className='text-lg font-medium'>Існуючі теги</h2>
          {isLoading ? (
            <p className='text-gray-500'>Завантаження...</p>
          ) : tags && tags.length > 0 ? (
            <div className='max-h-[300px] overflow-y-auto pr-2 flex flex-col gap-2'>
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className='flex items-center justify-between p-3 border-2 border-gray-100 rounded-xl hover:border-primary transition-colors'
                >
                  <div className='flex items-center gap-3'>
                    <span
                      className={`w-3 h-3 rounded-full ${tag.severity === 3 ? 'bg-red-500' : tag.severity === 2 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    ></span>
                    <span className='font-medium'>{tag.name}</span>
                  </div>
                  <button
                    type='button'
                    onClick={() => {
                      if (
                        window.confirm(
                          'Ви впевнені, що хочете видалити цей тег?'
                        )
                      ) {
                        deleteTag(tag.id)
                      }
                    }}
                    className='text-red-400 hover:text-red-600 p-2 transition-colors'
                    title='Видалити тег'
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-gray-500 italic'>Тегів поки немає</p>
          )}
        </div>
      </div>
    </MyModal>
  )
}

export default TagModal
