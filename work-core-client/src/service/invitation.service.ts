import { axiosClassic } from '@/api/interceptors'

export interface IInvitationResult {
  userId: number
  firstName: string
  lastName: string
  email: string
  token: string
  registrationLink: string
}

export interface IInvitationInfo {
  firstName: string
  lastName: string
  email: string
}

class InvitationService {
  // Адмін створює запрошення
  public async create(data: {
    firstName: string
    lastName: string
    email: string
  }) {
    return await axiosClassic.post<IInvitationResult>('/invitations', data)
  }

  public async sendEmail(userId: number) {
    return await axiosClassic.post(`/invitations/${userId}/send`)
  }

  // Публічні (без авторизації)
  public async getByToken(token: string) {
    return await axiosClassic.get<IInvitationInfo>('/invitations', {
      params: { token },
    })
  }

  public async accept(token: string, password: string) {
    return await axiosClassic.post('/invitations/accept', { token, password })
  }
}

export const invitationService = new InvitationService()
