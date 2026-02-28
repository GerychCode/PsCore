import { axiosClassic } from '@/api/interceptors'
import {
  IWorkScheduleCreate,
  IWorkScheduleUpdate,
  ILockWeek,
} from '@/interface/IWorkSchedule'

class WorkScheduleService {
  public async getWeekView(date: string) {
    return await axiosClassic.get(`/work-schedule/week-view`, {
      params: { date },
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
