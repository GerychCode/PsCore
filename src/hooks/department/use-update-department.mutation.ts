import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { departmentService } from '@/service/department.service'
import { IDepartment } from '@/interface/IDepartment'

export function useUpdateDepartmentMutation(
    id: number,
    onSuccess: () => void
) {
    return useMutation({
        mutationKey: ['updateDepartment', id],
        mutationFn: (data: IDepartment) =>
            departmentService.updateDepartment(id, data),
        onSuccess: () => {
            toast.success('Відділення оновлено!')
            onSuccess()
        },
        onError: () => {
            toast.error('Не вдалось оновити відділення!')
        },
    })
}