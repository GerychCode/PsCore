import { axiosClassic } from '@/api/interceptors'

export type SwapStatus =
  | 'OPEN'
  | 'CLAIMED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

export interface ISwapUser {
  id: number
  firstName: string
  lastName: string
  avatar?: string
}

export interface IShiftSwap {
  id: number
  scheduleId: number
  status: SwapStatus
  reason?: string | null
  createdAt: string
  resolvedAt?: string | null
  requester: ISwapUser
  claimer?: ISwapUser | null
  target?: ISwapUser | null
  schedule: {
    id: number
    date: string
    startedAt: string
    endTime: string
    department: { id: number; name: string }
  }
}

export interface ISwapList {
  available: IShiftSwap[]
  mine: IShiftSwap[]
  claimed: IShiftSwap[]
  pendingApproval: IShiftSwap[]
  canManage: boolean
}

export interface ICreateSwap {
  scheduleId: number
  targetUserId?: number
  reason?: string
}

class ShiftSwapService {
  async list() {
    return axiosClassic.get<ISwapList>('/shift-swaps')
  }

  async create(data: ICreateSwap) {
    return axiosClassic.post<IShiftSwap>('/shift-swaps', data)
  }

  async claim(id: number) {
    return axiosClassic.post<IShiftSwap>(`/shift-swaps/${id}/claim`)
  }

  async cancel(id: number) {
    return axiosClassic.post<IShiftSwap>(`/shift-swaps/${id}/cancel`)
  }

  // Потребує права MANAGE_SCHEDULE
  async approve(id: number) {
    return axiosClassic.post<IShiftSwap>(`/shift-swaps/${id}/approve`)
  }

  async reject(id: number) {
    return axiosClassic.post<IShiftSwap>(`/shift-swaps/${id}/reject`)
  }
}

export const shiftSwapService = new ShiftSwapService()
