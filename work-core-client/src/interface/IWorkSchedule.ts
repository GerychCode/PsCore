export interface IWorkSchedule {
  id: number
  date: string
  startedAt: string
  endTime: string
  isDayOff: boolean
}

export interface IEmployeeSchedule {
  userId: number
  firstName: string
  lastName: string
  schedule: (IWorkSchedule | null)[]
}

export interface IWeekView {
  departmentId: number
  departmentName: string
  isLocked: boolean
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
