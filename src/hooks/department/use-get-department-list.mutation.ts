import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import axios, { AxiosError } from 'axios'
import { departmentService } from '@/service/department.service'
import { IDepartment } from '@/interface/IDepartment'

export function useGetDepartmentListMutation() {
    const {
        mutate,
        isPending,
        data: departments,
    } = useMutation<IDepartment[], AxiosError>({
        mutationKey: ['getDepartmentsList'],
        mutationFn: async () => {
            const response = await departmentService.getDepartmentList()
            const departments = response.data

            if (!departments) toast.error('Не вдалось завантажити відділення!')
            return departments
        },
        onError: (error: unknown | Error) => {
            if (axios.isAxiosError(error)) {
                const data = error.response?.data
                toast.error(data?.message || error.message)
            } else {
                toast.error('Виникла помилка, спробуйте пізніше!')
            }
        },
    })

    return { mutate, isPending, departments }
}