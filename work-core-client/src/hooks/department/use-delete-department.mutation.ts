import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { departmentService } from '@/service/department.service'

export function useDeleteDepartmentMutation(
    id: number,
    onSuccess: () => void
) {
    return useMutation({
        mutationKey: ['deleteDepartment', id],
        mutationFn: () => departmentService.deleteDepartment(id),
        onSuccess: () => {
            toast.success('Відділення видалено!')
            onSuccess()
        },
        onError: () => {
            toast.error('Не вдалось видалити відділення!')
        },
    })
}