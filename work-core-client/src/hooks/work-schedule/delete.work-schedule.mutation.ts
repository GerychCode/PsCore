import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workScheduleService } from '@/service/work.schedule.service'

export function useDeleteWorkScheduleMutation(
    id: number,
    onSuccess: () => void
) {
    return useMutation({
        mutationKey: ['deleteWorkSchedule', id],
        mutationFn: () => workScheduleService.deleteSchedule(id),
        onSuccess: () => {
            toast.success('Запис видалено!')
            onSuccess()
        },
        onError: () => {
            toast.error('Не вдалось видалити запис!')
        },
    })
}