import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { userService } from '@/service/user.service'
import axios from 'axios'
import { AxiosError } from 'axios'
import { IUser } from '@/interface/IUser'
import { userStore } from '@/store/user.store'

export function useGetUserMutation() {
  const {
    mutate,
    isPending
  } = useMutation<IUser, AxiosError>({
    mutationKey: ['getUser'],
    mutationFn: async () => {
      const response = await userService.getUserData()
      const user = response.data

      if (!user) toast.error('Не вдалось завантажити користувачів!')
      else userStore.getState().updateUser(user);
      return user;
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

  return { mutate, isPending }
}
