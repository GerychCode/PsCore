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
  dateOfBirth?: string
  phone?: string
  address?: string
  createdAt: string
  updatedAt: string
  appRoles?: IAppRole[]
  permissions?: string[]
}