import { axiosClassic } from '@/api/interceptors'
import {
    IDepartment,
    IDepartmentMember,
    ITelegramLinkCode,
    ITelegramLinkStatus,
} from '@/interface/IDepartment'

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

    // --- Telegram-акаунт відділення (куди приходять коди підтвердження змін) ---

    public async getTelegramStatus(id: number) {
        return await axiosClassic.get<ITelegramLinkStatus>(
            `/department/${id}/telegram`
        )
    }

    public async createTelegramCode(id: number) {
        return await axiosClassic.post<ITelegramLinkCode>(
            `/department/${id}/telegram/code`
        )
    }

    public async unlinkTelegram(id: number) {
        return await axiosClassic.delete(`/department/${id}/telegram`)
    }
}

export const departmentService = new DepartmentService()