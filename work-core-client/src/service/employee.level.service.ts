import { axiosClassic } from '@/api/interceptors'

export interface IEmployeeLevel {
  userId: number
  level: number
  baseLevel: number
  xp: number
  reliability: number
  totalShifts: number
}

class EmployeeLevelService {
  public async getRanking() {
    return await axiosClassic.get<IEmployeeLevel[]>('/employee-level/ranking')
  }

  public async getEmployeeLevel(userId: number) {
    return await axiosClassic.get<IEmployeeLevel>(`/employee-level/${userId}`)
  }
}

export const employeeLevelService = new EmployeeLevelService()
