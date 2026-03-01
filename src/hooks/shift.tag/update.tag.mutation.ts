import { UseFormSetError } from 'react-hook-form'
import { tagService } from '@/service/shift.tag.service'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ITagUpdate } from '@/interface/ITag'

export function useUpdateTagMutation(
  reset: () => void,
  setError: UseFormSetError<ITagUpdate>,
  onSuccessCallback: () => void
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['update-tag'],
    mutationFn: ({ id, data }: { id: number; data: ITagUpdate }) =>
      tagService.update(id, data),
    onSuccess: () => {
      toast.success('Тег успішно оновлено!')
      reset()
      onSuccessCallback()
      queryClient.invalidateQueries({ queryKey: ['shift-tag'] })
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data
        if (Array.isArray(data?.errors)) {
          data.errors.forEach(
            (err: { field: keyof ITagUpdate; message: string }) => {
              setError(err.field, {
                type: 'manual',
                message: err.message,
              })
            }
          )
        }
        toast.error(
          data?.message || error.message || 'Помилка при оновленні тегу'
        )
      } else {
        toast.error('Виникла помилка, спробуйте пізніше!')
      }
    },
  })
}
