import { axiosClassic } from '@/api/interceptors'
import { IShift } from '@/interface/IShift'

export interface IShiftCreate {
  userId?: number
  departmentId: number
  date: string
  startedAt: string
  endTime: string
}

export interface IShiftUpdate {
  departmentId?: number
  startedAt?: string
  endTime?: string
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
}

class ShiftService {
  public async getShiftList(filters?: any) {
    return await axiosClassic.get<IShift[]>(`/shift`, { params: filters })
  }

  public async createShift(data: IShiftCreate) {
    return await axiosClassic.post(`/shift`, data)
  }

  public async updateShift(id: number, data: IShiftUpdate) {
    return await axiosClassic.put(`/shift/${id}`, data)
  }

  public async deleteShift(id: number) {
    return await axiosClassic.delete(`/shift/${id}`)
  }
}

export const shiftService = new ShiftService()
