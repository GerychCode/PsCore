import { IDepartment } from '@/interface/IDepartment'

export interface ITag {
  id: number
  name: string
  severity: number
}

export interface IShift {
  id: number
  userId: number
  departmentId: number
  date: string
  startedAt: string
  endTime: string
  totalHours: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  updatedAt: string
  user: {
    id: number
    firstName: string
    lastName: string
    avatar: string
  }
  department: IDepartment
  tags: ITag[]
}
