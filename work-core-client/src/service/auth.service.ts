import { axiosClassic } from '@/api/interceptors'
import { IUserLogin } from '@/interface/IUserAuth'

class AuthService {
  public async login(data: IUserLogin) {
    return await axiosClassic.post(`/auth/login`, data)
  }

  public async logout() {
    return await axiosClassic.post(`/auth/logout`)
  }

  public async changePassword(currentPassword: string, newPassword: string) {
    return await axiosClassic.post(`/auth/change-password`, {
      currentPassword,
      newPassword,
    })
  }

  public async verifyEmail(token: string) {
    return await axiosClassic.post(`/auth/verify-email`, { token })
  }

  public async resendVerification(email: string) {
    return await axiosClassic.post(`/auth/resend-verification`, { email })
  }

  public async forgotPassword(email: string) {
    return await axiosClassic.post(`/auth/forgot-password`, { email })
  }

  public async resetPassword(token: string, password: string) {
    return await axiosClassic.post(`/auth/reset-password`, { token, password })
  }
}
export const authService = new AuthService()
