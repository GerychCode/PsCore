'use client'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { IUserUpdate } from '@/interface/IUserUpdate'
import { userService } from '@/service/user.service'

/**
 * @param targetUserId якщо передано — редагуємо ЧУЖИЙ профіль через
 * адмінський ендпоінт (потребує MANAGE_USERS). Без нього — свій власний.
 */
export function userUpdate(data: IUserUpdate, targetUserId?: number) {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: ['updateUser', targetUserId ?? 'self'],
    mutationFn: async () =>
      targetUserId
        ? await userService.updateUserAdmin(targetUserId, data)
        : await userService.updateUser(data),
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
