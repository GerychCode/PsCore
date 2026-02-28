import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { departmentService } from '@/service/department.service'
import { IDepartment } from '@/interface/IDepartment'

export function useCreateDepartmentMutation(onSuccess: () => void) {
    return useMutation({
        mutationKey: ['createDepartment'],
        mutationFn: (data: IDepartment) =>
            departmentService.createDepartment(data),
        onSuccess: () => {
            toast.success('Відділення створено!')
            onSuccess()
        },
        onError: (error: any) => {
            const errorMessage = error.response?.data?.message || 'Не вдалось створити відділення!'
            toast.error(errorMessage)
        },
    })
}