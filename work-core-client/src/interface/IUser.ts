export type NotificationCategory = 'shift' | 'chat' | 'schedule' | 'system'
export type NotificationChannel = 'web' | 'telegram'
export type NotificationPrefs = Record<
  NotificationCategory,
  Record<NotificationChannel, boolean>
>

export interface IAppRole {
  id: number
  name: string
  color: string
  permissions: string[]
  position: number
  isSystem?: boolean
  isDefault?: boolean
}

export interface IUser {
  id: number
  avatar: string
  firstName: string
  lastName: string
  email: string
  role: 'Admin' | 'Manager' | 'Employe'
  baseLevel?: number
  mustChangePassword?: boolean
  notificationPrefs?: NotificationPrefs | null
  dateOfBirth?: string
  phone?: string
  address?: string
  createdAt: string
  updatedAt: string
  appRoles?: IAppRole[]
  permissions?: string[]
}