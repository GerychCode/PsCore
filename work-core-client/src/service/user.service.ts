import { axiosClassic, axiosFormData } from '@/api/interceptors'
import { IUserUpdate } from '@/interface/IUserUpdate'

class UserService {
  public async getUserData() {
    return await axiosClassic.get(`/user`)
  }

  public async getUsersData() {
    return await axiosClassic.get(`/user/list`)
  }

  public async getUserById(id: number) {
    return await axiosClassic.get(`/user/list/${id}`)
  }

  public async updateUser(data: IUserUpdate) {
    return await axiosClassic.put(`/user`, data)
  }

  async updateUserAvatar(data: FormData) {
    return await axiosFormData.put(`/user/avatar`, data)
  }

  async generateTelegramCode() {
    return await axiosClassic.post<{ code: string }>(`/user/telegram-code`)
  }

  public async getUserStatistics(id: number, month?: number, year?: number) {
    return await axiosClassic.get(`/user/${id}/statistics`, {
      params: { month, year },
    })
  }
}

export const userService = new UserService()
