import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  shiftService,
  IShiftCreate,
  IShiftUpdate,
} from '@/service/shift.service'

export function useCreateShiftMutation(onSuccess: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['createShift'],
    mutationFn: (data: IShiftCreate) => shiftService.createShift(data),
    onSuccess: () => {
      toast.success('Зміну успішно створено!')
      queryClient.invalidateQueries({ queryKey: ['getShiftList'] })
      onSuccess()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Не вдалось створити зміну')
    },
  })
}

export function useUpdateShiftMutation(id: number, onSuccess: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['updateShift', id],
    mutationFn: (data: IShiftUpdate) => shiftService.updateShift(id, data),
    onSuccess: () => {
      toast.success('Зміну оновлено!')
      queryClient.invalidateQueries({ queryKey: ['getShiftList'] })
      onSuccess()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Не вдалось оновити зміну')
    },
  })
}

export function useDeleteShiftMutation(onSuccess: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['deleteShift'],
    mutationFn: (id: number) => shiftService.deleteShift(id),
    onSuccess: () => {
      toast.success('Зміну видалено!')
      queryClient.invalidateQueries({ queryKey: ['getShiftList'] })
      onSuccess()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Не вдалось видалити зміну')
    },
  })
}
