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
}