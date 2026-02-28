'use client'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { authService } from '@/service/auth.service'
import { PathConfig } from '@/config/path.config'
import { toast } from 'sonner'
import axios, { AxiosError } from 'axios'

export function userLogoutMutation() {
  const router = useRouter()

  const { mutate, isPending } = useMutation<any, AxiosError>({
    mutationKey: ['logout'],
    mutationFn: async () => await authService.logout(),
    onSuccess: () => {
      router.push(PathConfig.LOGIN)
      toast.success('Ви вийшли з аккаунту')
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
