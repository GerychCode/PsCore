import { axiosClassic } from '@/api/interceptors'
import { IScheduleWish } from '@/interface/IWorkSchedule'

class ScheduleWishService {
  public async getMyWishes(from?: string, to?: string) {
    return await axiosClassic.get<IScheduleWish[]>('/schedule-wish', {
      params: { from, to },
    })
  }

  public async addWish(date: string) {
    return await axiosClassic.post<IScheduleWish>('/schedule-wish', { date })
  }

  public async removeWishByDate(date: string) {
    return await axiosClassic.delete('/schedule-wish/by-date', {
      params: { date },
    })
  }
}

export const scheduleWishService = new ScheduleWishService()
