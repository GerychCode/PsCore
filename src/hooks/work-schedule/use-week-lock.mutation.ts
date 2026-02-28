import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workScheduleService } from '@/service/work.schedule.service'
import { ILockWeek } from '@/interface/IWorkSchedule'

export function useWeekLockMutation(onSuccess: () => void) {
  return useMutation({
    mutationKey: ['toggleWeekLock'],
    mutationFn: (data: ILockWeek) => workScheduleService.toggleWeekLock(data),
    onSuccess: (data, variables) => {
      const status = variables.isLocked ? 'заблоковано' : 'розблоковано'
      toast.success(`Тиждень успішно ${status}!`)
      onSuccess()
    },
    onError: () => {
      toast.error('Не вдалось змінити статус блокування!')
    },
  })
}
