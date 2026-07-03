export interface IUser {
  id: number
  avatar: string
  firstName: string
  lastName: string
  email: string
  role: 'Admin' | 'Manager' | 'Employe'
  baseLevel?: number
  dateOfBirth?: string
  phone?: string
  address?: string
  createdAt: string
  updatedAt: string
}