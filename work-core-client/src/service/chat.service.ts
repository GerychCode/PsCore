import { axiosClassic } from '@/api/interceptors'
import { IConversation, IConversationHistory } from '@/interface/IChat'

class ChatService {
  public async getConversations() {
    return await axiosClassic.get<IConversation[]>('/chat/conversations')
  }

  public async getConversation(partnerId: number, cursor?: number) {
    return await axiosClassic.get<IConversationHistory>(
      `/chat/with/${partnerId}`,
      { params: { cursor } }
    )
  }

  public async markConversationRead(partnerId: number) {
    return await axiosClassic.patch(`/chat/with/${partnerId}/read`)
  }

  public async getUnreadCount() {
    return await axiosClassic.get<{ count: number }>('/chat/unread-count')
  }
}

export const chatService = new ChatService()
