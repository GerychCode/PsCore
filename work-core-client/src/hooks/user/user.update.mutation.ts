'use client'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { IUserUpdate } from '@/interface/IUserUpdate'
import { userService } from '@/service/user.service'

export function userUpdate(data: IUserUpdate) {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: ['updateUser'],
    mutationFn: async () => await userService.updateUser(data),
    onSuccess: () => {
      toast.success('Дані оновлено!')
    },
    onError: (error) => toast.error(error.message),
  })

  return { mutateAsync, isPending }
}

export function userUpdateAvatar() {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: ['updateUser'],
    mutationFn: async (data: FormData) =>
      await userService.updateUserAvatar(data),
    onSuccess: () => {
      toast.success('Аватарку оновлено!')
    },
    onError: (error) => toast.error(error.message),
  })

  return { mutateAsync, isPending }
}
