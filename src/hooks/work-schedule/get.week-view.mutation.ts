import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workScheduleService } from '@/service/work.schedule.service'
import { IWeekView } from '@/interface/IWorkSchedule'

export function useGetWeekViewMutation(
    date: string,
    onSuccess: (data: IWeekView[]) => void
) {
    return useMutation({
        mutationKey: ['getWeekView', date],
        mutationFn: () => workScheduleService.getWeekView(date),
        onSuccess: (response) => {
            onSuccess(response.data)
        },
        onError: () => {
            toast.error('Не вдалось завантажити графік роботи!')
        },
    })
}