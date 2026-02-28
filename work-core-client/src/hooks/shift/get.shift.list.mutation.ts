import { useMutation } from '@tanstack/react-query'
import axios, { AxiosError } from 'axios'
import { toast } from 'sonner'
import { shiftService } from '@/service/shift.service'
import { IShift } from '@/interface/IShift'

export function useGetShiftListMutation() {
  const {
    mutate,
    isPending,
    data: shift,
  } = useMutation<IShift[], AxiosError>({
    mutationKey: ['getShiftList'],
    mutationFn: async () => {
      const response = await shiftService.getShiftList()
      const shift = response.data

      if (!shift) toast.error('Не вдалось завантажити зміни!')
      return [...shift]
    },
    onError: (error: unknown | Error) => {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data
        toast.error(error.message || data?.message)
      } else {
        toast.error('Виникла помилка, спробуйте пізніше!')
      }
    },
  })

  return { mutate, isPending, shift }
}
