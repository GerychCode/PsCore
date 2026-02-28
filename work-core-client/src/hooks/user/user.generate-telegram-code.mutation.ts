'use client'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { userService } from '@/service/user.service'
import { AxiosError } from 'axios'

export function useGenerateTelegramCodeMutation() {
    return useMutation({
    mutationKey: ['generateTelegramCode'],
    mutationFn: () => userService.generateTelegramCode(),
onSuccess: () => {
toast.success('Код успішно згенеровано!')
},
onError: (error: AxiosError<{ message: string }>) => {
    const message = error.response?.data?.message || 'Помилка генерації коду.'
    toast.error(message)
},
})
}