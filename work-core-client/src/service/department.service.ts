import { axiosClassic } from '@/api/interceptors'
import { IDepartment, IDepartmentMember } from '@/interface/IDepartment'

class DepartmentService {
    public async getDepartmentList() {
        return await axiosClassic.get(`/department`)
    }

    public async getMembers(id: number) {
        return await axiosClassic.get<IDepartmentMember[]>(
            `/department/${id}/members`
        )
    }

    public async setMembers(id: number, userIds: number[]) {
        return await axiosClassic.put(`/department/${id}/members`, { userIds })
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