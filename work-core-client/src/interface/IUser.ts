export interface IUser {
  id: number
  avatar: string
  firstName: string
  lastName: string
  email: string
  role: 'Admin' | 'Manager' | 'Employe'
  dateOfBirth?: string
  phone?: string
  address?: string
  createdAt: string
  updatedAt: string
}