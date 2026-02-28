import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workScheduleService } from '@/service/work.schedule.service'
import { IWorkScheduleCreate } from '@/interface/IWorkSchedule'

export function useCreateWorkScheduleMutation(onSuccess: () => void) {
    return useMutation({
        mutationKey: ['createWorkSchedule'],
        mutationFn: (data: IWorkScheduleCreate) =>
            workScheduleService.createSchedule(data),
        onSuccess: () => {
            toast.success('Зміну додано!')
            onSuccess()
        },
        onError: (error: any) => {
            const errorMessage = error.response?.data?.message || 'Не вдалось додати зміну!'
            toast.error(errorMessage)
        },
    })
}