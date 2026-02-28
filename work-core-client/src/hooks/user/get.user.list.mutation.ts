import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { userService } from '@/service/user.service'
import axios from 'axios'
import { AxiosError } from 'axios'
import { IUser } from '@/interface/IUser'

export function useGetUserListMutation() {
  const {
    mutate,
    isPending,
    data: users,
  } = useMutation<IUser[], AxiosError>({
    mutationKey: ['getUsersList'],
    mutationFn: async () => {
      const response = await userService.getUsersData()
      const users = response.data

      if (!users) toast.error('Не вдалось завантажити користувачів!')
      return users
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

  return { mutate, isPending, users }
}
