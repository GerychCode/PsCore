import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workScheduleService } from '@/service/work.schedule.service'
import { IWorkScheduleUpdate } from '@/interface/IWorkSchedule'

export function useUpdateWorkScheduleMutation(
    id: number,
    onSuccess: () => void
) {
    return useMutation({
        mutationKey: ['updateWorkSchedule', id],
        mutationFn: (data: IWorkScheduleUpdate) =>
            workScheduleService.updateSchedule(id, data),
        onSuccess: () => {
            toast.success('Графік оновлено!')
            onSuccess()
        },
        onError: () => {
            toast.error('Не вдалось оновити графік!')
        },
    })
}