import { axiosClassic } from '@/api/interceptors'
import {
  IWorkScheduleCreate,
  IWorkScheduleUpdate,
  ILockWeek,
  IGenerateResult,
} from '@/interface/IWorkSchedule'

class WorkScheduleService {
  public async getWeekView(date: string) {
    return await axiosClassic.get(`/work-schedule/week-view`, {
      params: { date },
    })
  }

  public async generateWeek(departmentId: number, date: string) {
    return await axiosClassic.post<IGenerateResult>(
      `/work-schedule/generate`,
      { departmentId, date }
    )
  }

  public async publishGeneratedWeek(departmentId: number, date: string) {
    return await axiosClassic.post(`/work-schedule/generate/publish`, {
      departmentId,
      date,
    })
  }

  public async rejectGeneratedWeek(departmentId: number, date: string) {
    return await axiosClassic.post(`/work-schedule/generate/reject`, {
      departmentId,
      date,
    })
  }

  public async createSchedule(data: IWorkScheduleCreate) {
    return await axiosClassic.post(`/work-schedule`, data)
  }

  public async updateSchedule(id: number, data: IWorkScheduleUpdate) {
    return await axiosClassic.put(`/work-schedule/${id}`, data)
  }

  public async deleteSchedule(id: number) {
    return await axiosClassic.delete(`/work-schedule/${id}`)
  }

  public async toggleWeekLock(data: ILockWeek) {
    return await axiosClassic.post(`/work-schedule/lock`, data)
  }
}

export const workScheduleService = new WorkScheduleService()
