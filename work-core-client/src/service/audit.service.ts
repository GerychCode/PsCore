import { axiosClassic } from '@/api/interceptors'

export interface IAuditActor {
  id: number
  firstName: string
  lastName: string
  avatar?: string
}

export interface IAuditLog {
  id: number
  actorId: number | null
  action: string
  entity: string
  entityId: number | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
  createdAt: string
  actor?: IAuditActor | null
}

export interface IAuditQuery {
  entity?: string
  action?: string
  actorId?: number
  limit?: number
  cursor?: number
}

export interface IAuditPage {
  items: IAuditLog[]
  nextCursor: number | null
}

// Людські назви дій для UI
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ROLE_CREATED: 'Створено роль',
  ROLE_UPDATED: 'Оновлено роль',
  ROLE_DELETED: 'Видалено роль',
  ROLES_ASSIGNED: 'Призначено ролі',
  USER_DELETED: 'Видалено користувача',
  SHIFT_APPROVED: 'Підтверджено зміну',
  SHIFT_REJECTED: 'Відхилено зміну',
  SHIFT_DELETED: 'Видалено зміну',
  SHIFT_AUTO_CLOSED: 'Авто-завершення зміни',
  SWAP_CREATED: 'Запропоновано обмін зміни',
  SWAP_CLAIMED: 'Взято зміну на обмін',
  SWAP_APPROVED: 'Підтверджено обмін зміни',
  SWAP_REJECTED: 'Відхилено обмін зміни',
  SWAP_CANCELLED: 'Скасовано обмін зміни',
}

class AuditService {
  // Потребує права VIEW_AUDIT_LOG
  async list(query: IAuditQuery = {}) {
    return axiosClassic.get<IAuditPage>('/audit-logs', { params: query })
  }
}

export const auditService = new AuditService()
