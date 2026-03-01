import { UseFormSetError } from 'react-hook-form'
import { tagService } from '@/service/shift.tag.service'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ITagCreate } from '@/interface/ITag'

export function useCreateTagMutation(
  reset: () => void,
  setError: UseFormSetError<ITagCreate>,
  onSuccessCallback: () => void
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['create-tag'],
    mutationFn: (data: ITagCreate) => tagService.create(data),
    onSuccess: () => {
      toast.success('Тег успішно створено!')
      reset()
      onSuccessCallback()
      // Оновлюємо список тегів
      queryClient.invalidateQueries({ queryKey: ['shift-tag'] })
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data
        if (Array.isArray(data?.errors)) {
          data.errors.forEach(
            (err: { field: keyof ITagCreate; message: string }) => {
              setError(err.field, {
                type: 'manual',
                message: err.message,
              })
            }
          )
        }
        toast.error(
          data?.message || error.message || 'Помилка при створенні тегу'
        )
      } else {
        toast.error('Виникла помилка, спробуйте пізніше!')
      }
    },
  })
}
