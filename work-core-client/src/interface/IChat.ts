export interface IChatMessage {
  id: number
  senderId: number
  receiverId: number
  content: string
  isRead: boolean
  createdAt: string
  sender?: IChatPartner
}

export interface IChatPartner {
  id: number
  firstName: string
  lastName: string
  avatar?: string
}

export interface IConversation {
  partner: IChatPartner
  lastMessage: IChatMessage
  unreadCount: number
}

export interface IConversationHistory {
  messages: IChatMessage[]
  hasMore: boolean
}
