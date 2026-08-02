import { axiosClassic } from '@/api/interceptors'
import {
    IAbsence,
    IAbsenceBalance,
    ICreateAbsence,
} from '@/interface/IAbsence'

class AbsenceService {
    /** Без MANAGE_SCHEDULE сервер сам обмежить видачу власними заявками. */
    public async list(params?: {
        userId?: number
        status?: string
        type?: string
        from?: string
        to?: string
    }) {
        return await axiosClassic.get<IAbsence[]>('/absences', { params })
    }

    public async balance(userId?: number) {
        return await axiosClassic.get<IAbsenceBalance>('/absences/balance', {
            params: userId ? { userId } : undefined,
        })
    }

    public async create(data: ICreateAbsence) {
        return await axiosClassic.post<IAbsence>('/absences', data)
    }

    public async approve(id: number, comment?: string) {
        return await axiosClassic.post<IAbsence>(`/absences/${id}/approve`, {
            comment,
        })
    }

    public async reject(id: number, comment?: string) {
        return await axiosClassic.post<IAbsence>(`/absences/${id}/reject`, {
            comment,
        })
    }

    public async cancel(id: number) {
        return await axiosClassic.post<IAbsence>(`/absences/${id}/cancel`)
    }
}

export const absenceService = new AbsenceService()
