import { axiosClassic } from '@/api/interceptors'
import { IAppRole } from '@/interface/IUser'

export interface IAppRoleWithCount extends IAppRole {
  _count?: { members: number }
}

class RolesService {
  public async getAll() {
    return await axiosClassic.get<IAppRoleWithCount[]>('/roles')
  }

  public async getPermissions() {
    return await axiosClassic.get<string[]>('/roles/permissions')
  }

  public async create(data: Partial<IAppRole>) {
    return await axiosClassic.post<IAppRole>('/roles', data)
  }

  public async update(id: number, data: Partial<IAppRole>) {
    return await axiosClassic.put<IAppRole>(`/roles/${id}`, data)
  }

  public async remove(id: number) {
    return await axiosClassic.delete(`/roles/${id}`)
  }

  public async getUserRoles(userId: number) {
    return await axiosClassic.get<IAppRole[]>(`/roles/user/${userId}`)
  }

  public async setUserRoles(userId: number, roleIds: number[]) {
    return await axiosClassic.put(`/roles/user/${userId}`, { roleIds })
  }
}

export const rolesService = new RolesService()

// Людські назви прав для UI
export const PERMISSION_LABELS: Record<string, string> = {
  ADMINISTRATOR: 'Адміністратор (повний доступ)',
  MANAGE_ROLES: 'Керування ролями',
  MANAGE_USERS: 'Керування користувачами',
  MANAGE_DEPARTMENTS: 'Керування відділеннями',
  MANAGE_SCHEDULE: 'Керування графіком',
  APPROVE_SHIFTS: 'Підтвердження змін',
  MANAGE_TAGS: 'Керування тегами',
  VIEW_ALL_PROFILES: 'Перегляд усіх профілів',
  VIEW_AUDIT_LOG: 'Перегляд журналу аудиту',
}
