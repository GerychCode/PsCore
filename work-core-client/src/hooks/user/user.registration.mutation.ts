import { UseFormSetError } from 'react-hook-form'
import { authService } from '@/service/auth.service'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

type Inputs = {
  email: string
  password: string
}

export function useRegistrationMutation(
  reset: () => void,
  setError: UseFormSetError<{
    email: string
    password: string
  }>,
  onSuccessCallback: () => void
) {
  return useMutation({
    mutationKey: ['registration'],
    mutationFn: authService.register,
    onSuccess: () => {
      toast.success('Регестрації пройшла успішно!')
      reset()
      onSuccessCallback()
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data
        if (Array.isArray(data?.errors)) {
          data.errors.forEach(
            (err: { field: keyof Inputs; message: string }) => {
              setError(err.field, {
                type: 'manual',
                message: err.message,
              })
            }
          )
        }

        toast.error(data?.message || error.message)
      } else {
        toast.error('Виникла помилка, спробуйте пізніше!')
      }
    },
  })
}
