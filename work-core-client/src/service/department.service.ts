import { axiosClassic } from '@/api/interceptors'
import { IDepartment } from '@/interface/IDepartment'

class DepartmentService {
    public async getDepartmentList() {
        return await axiosClassic.get(`/department`)
    }

    public async createDepartment(data: IDepartment) {
        return await axiosClassic.post(`/department`, data)
    }

    public async updateDepartment(id: number, data: IDepartment) {
        return await axiosClassic.put(`/department/${id}`, data)
    }

    public async deleteDepartment(id: number) {
        return await axiosClassic.delete(`/department/${id}`)
    }
}

export const departmentService = new DepartmentService()