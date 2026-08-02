'use client'

import React, { useState } from 'react'
import { useForm, SubmitHandler, UseFormSetError } from 'react-hook-form'
import { FaTrash, FaPen, FaLock, FaBolt } from 'react-icons/fa'
import MyModal from '@/app/components/Modal'
import { ITag, ITagCreate, ITagRule, ITagUpdate } from '@/interface/ITag'
import InputComponent from '@/app/components/forms/InputComponent'
import { useCreateTagMutation } from '@/hooks/shift.tag/create.tag.mutation'
import { useUpdateTagMutation } from '@/hooks/shift.tag/update.tag.mutation'
import { useDeleteTagMutation } from '@/hooks/shift.tag/delete.tag.mutation'
import { useGetTagsQuery } from '@/hooks/shift.tag/get.tags.query'
import { TagRuleBuilder, emptyRule } from './Tag.RuleBuilder'

interface TagModalProps {
  isOpen: boolean
  onClose: () => void
}

type TagFormFields = { name: string; severity: number }

const DEFAULT_COLOR = '#F59E0B'

const TagModal: React.FC<TagModalProps> = ({ isOpen, onClose }) => {
  const { data: tags, isLoading } = useGetTagsQuery()

  const { register, handleSubmit, reset, setError } = useForm<TagFormFields>({
    defaultValues: { severity: 1 },
  })

  // Поля поза RHF (складна вкладена структура правила)
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [autoApply, setAutoApply] = useState(false)
  const [rule, setRule] = useState<ITagRule>(emptyRule())
  const [editingId, setEditingId] = useState<number | null>(null)

  const resetForm = () => {
    reset({ name: '', severity: 1 })
    setColor(DEFAULT_COLOR)
    setAutoApply(false)
    setRule(emptyRule())
    setEditingId(null)
  }

  const { mutate: createTag, isPending: isCreating } = useCreateTagMutation(
    resetForm,
    setError as unknown as UseFormSetError<ITagCreate>,
    () => {}
  )
  const { mutate: updateTag, isPending: isUpdating } = useUpdateTagMutation(
    resetForm,
    setError as unknown as UseFormSetError<ITagUpdate>,
    () => {}
  )
  const { mutate: deleteTag } = useDeleteTagMutation()

  const onSubmit: SubmitHandler<TagFormFields> = (data) => {
    const payload: ITagCreate = {
      name: data.name,
      severity: Number(data.severity),
      color,
      autoApply,
      ...(autoApply && { rule }),
    }
    if (editingId) {
      updateTag({ id: editingId, data: payload })
    } else {
      createTag(payload)
    }
  }

  const startEdit = (tag: ITag) => {
    setEditingId(tag.id)
    reset({ name: tag.name, severity: tag.severity })
    setColor(tag.color || DEFAULT_COLOR)
    setAutoApply(!!tag.autoApply)
    setRule(tag.rule ?? emptyRule())
  }

  const isBusy = isCreating || isUpdating

  return (
    <MyModal isOpen={isOpen} onClose={onClose}>
      <div className='flex flex-col gap-6 w-full min-w-[350px] sm:min-w-[560px]'>
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

        <form
          onSubmit={handleSubmit(onSubmit)}
          className='flex flex-col gap-4 p-4 border-2 border-gray-100 rounded-2xl bg-gray-50'
        >
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-medium'>
              {editingId ? 'Редагувати тег' : 'Створити новий тег'}
            </h2>
            {editingId && (
              <button
                type='button'
                onClick={resetForm}
                className='text-xs text-gray-500 underline hover:text-gray-700'
              >
                Скасувати редагування
              </button>
            )}
          </div>

          <div className='flex gap-4 items-end'>
            <div className='flex-1'>
              <InputComponent
                {...register('name', { required: 'Назва обовʼязкова' })}
                type='text'
                label='Назва тегу'
                placeholder='Наприклад: Овертайм'
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
            <div className='w-20'>
              <label className='block mb-2 font-medium text-sm text-gray-700'>
                Колір
              </label>
              <input
                type='color'
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className='h-[50px] w-full rounded-2xl border-2 border-gray-200 bg-white cursor-pointer'
              />
            </div>
          </div>

          {/* Перемикач автоматизації */}
          <label className='flex items-center gap-3 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className='w-5 h-5 accent-primary'
            />
            <span className='flex items-center gap-2 text-sm font-medium text-gray-700'>
              <FaBolt className='text-amber-500' />
              Авто-застосування за правилом
            </span>
          </label>

          {autoApply && <TagRuleBuilder value={rule} onChange={setRule} />}

          <button
            type='submit'
            disabled={isBusy}
            className='rounded-2xl bg-primary text-white px-4 py-3 hover:opacity-90 disabled:opacity-50 mt-2 font-medium'
          >
            {isBusy
              ? 'Збереження...'
              : editingId
                ? 'Зберегти зміни'
                : 'Додати тег'}
          </button>
        </form>

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
                  <div className='flex items-center gap-3 min-w-0'>
                    <span
                      className='w-3 h-3 rounded-full shrink-0'
                      style={{
                        backgroundColor:
                          tag.color ||
                          (tag.severity === 3
                            ? '#ef4444'
                            : tag.severity === 2
                              ? '#eab308'
                              : '#22c55e'),
                      }}
                    />
                    <span className='font-medium truncate'>{tag.name}</span>
                    {tag.autoApply && (
                      <span className='flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0'>
                        <FaBolt size={8} /> АВТО
                      </span>
                    )}
                    {tag.isSystem && (
                      <span className='flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0'>
                        <FaLock size={8} /> СИСТЕМНИЙ
                      </span>
                    )}
                  </div>
                  <div className='flex items-center gap-1 shrink-0'>
                    {!tag.isSystem && (
                      <button
                        type='button'
                        onClick={() => startEdit(tag)}
                        className='text-gray-400 hover:text-primary p-2 transition-colors'
                        title='Редагувати тег'
                      >
                        <FaPen size={13} />
                      </button>
                    )}
                    <button
                      type='button'
                      disabled={tag.isSystem}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Ви впевнені, що хочете видалити цей тег?'
                          )
                        ) {
                          deleteTag(tag.id)
                        }
                      }}
                      className='text-red-400 hover:text-red-600 p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
                      title={
                        tag.isSystem
                          ? 'Системний тег видалити не можна'
                          : 'Видалити тег'
                      }
                    >
                      <FaTrash size={13} />
                    </button>
                  </div>
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
