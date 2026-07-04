export interface IWorkSchedule {
  id: number
  date: string
  startedAt: string
  endTime: string
  isDayOff: boolean
  isDraft?: boolean
  wishViolated?: boolean
}

export interface IGenerateWarning {
  weekday: number
  type: 'UNDERSTAFFED' | 'WISH_VIOLATED'
  message: string
  userId?: number
}

export interface IGenerateResult {
  created: number
  warnings: IGenerateWarning[]
}

export interface IScheduleWish {
  id: number
  userId: number
  date: string
}

export interface IEmployeeSchedule {
  userId: number
  firstName: string
  lastName: string
  schedule: (IWorkSchedule | null)[]
}

export interface IDayCoverage {
  required: number
  assigned: number
}

export interface IWeekView {
  departmentId: number
  departmentName: string
  isLocked: boolean
  staffingByWeekday?: Record<string, number> | null
  coverage?: IDayCoverage[]
  users: IEmployeeSchedule[]
}

export interface IWorkScheduleCreate {
  userId: number
  departmentId: number
  date: string
  startedAt: string
  endTime: string
  isDayOff: boolean
}

export interface IWorkScheduleUpdate {
  startedAt?: string
  endTime?: string
  isDayOff?: boolean
}

export interface ILockWeek {
  departmentId: number
  date: string
  isLocked: boolean
}
