export interface IDepartment {
    id: number
    name: string
    address: string
    weekdaysOpeningTime: string
    weekdaysClosingTime: string
    weekendsOpeningTime: string
    weekendsClosingTime: string
    latitude?: number
    longitude?: number
    isActive: boolean
    staffingByWeekday?: Record<string, number>
}

/** Стан прив'язки Telegram-акаунта відділення. Сам chat id клієнту не віддаємо. */
export interface ITelegramLinkStatus {
    id: number
    name: string
    linked: boolean
}

/** Одноразовий код, який надсилають боту з акаунта відділення. */
export interface ITelegramLinkCode {
    code: string
    expiresInSec: number
}

export interface IDepartmentMember {
    id: number
    firstName: string
    lastName: string
    avatar?: string
    role: string
}