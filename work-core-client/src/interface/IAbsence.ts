export type AbsenceType = 'VACATION' | 'SICK' | 'UNPAID' | 'OTHER'
export type AbsenceStatus =
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED'

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
    VACATION: 'Відпустка',
    SICK: 'Лікарняний',
    UNPAID: 'Відгул за свій рахунок',
    OTHER: 'Інше',
}

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
    PENDING: 'Очікує рішення',
    APPROVED: 'Погоджено',
    REJECTED: 'Відхилено',
    CANCELLED: 'Скасовано',
}

/** Кольори бейджів статусу — узгоджені з рештою адмінки. */
export const ABSENCE_STATUS_STYLES: Record<AbsenceStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
}

export interface IAbsenceUser {
    id: number
    firstName: string
    lastName: string
    avatar?: string
}

export interface IAbsence {
    id: number
    userId: number
    type: AbsenceType
    status: AbsenceStatus
    startDate: string
    endDate: string
    reason?: string | null
    reviewComment?: string | null
    reviewedAt?: string | null
    user?: IAbsenceUser
    reviewedBy?: IAbsenceUser | null
    /** Скільки планових змін звільнилось при погодженні (лише у відповіді) */
    freedScheduleDays?: number
}

export interface IAbsenceBalance {
    year: number
    entitled: number
    used: number
    pending: number
    remaining: number
}

export interface ICreateAbsence {
    type: AbsenceType
    startDate: string
    endDate: string
    reason?: string
    userId?: number
}
