import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { userService } from '@/service/user.service'
import axios, { AxiosError } from 'axios'
import { IUser } from '@/interface/IUser'

export function getUserByIdMutation(id?: number) {
  const {
    mutate,
    isPending,
    data: user,
  } = useMutation<IUser, AxiosError>({
    mutationKey: ['getUserById', id],
    mutationFn: async () => {
      if (!id) throw new Error('ID is required')
      const response = await userService.getUserById(id)
      const user = response.data

      if (!user) toast.error('Не вдалось завантажити користувача!')
      return user
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

  return { mutate, isPending, user }
}
