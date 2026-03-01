import { tagService } from '@/service/shift.tag.service'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export function useDeleteTagMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['delete-tag'],
    mutationFn: (id: number) => tagService.delete(id),
    onSuccess: () => {
      toast.success('Тег успішно видалено!')
      if (onSuccessCallback) onSuccessCallback()
      queryClient.invalidateQueries({ queryKey: ['shift-tag'] })
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data
        toast.error(
          data?.message || error.message || 'Помилка при видаленні тегу'
        )
      } else {
        toast.error('Виникла помилка, спробуйте пізніше!')
      }
    },
  })
}
