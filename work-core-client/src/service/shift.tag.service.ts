import { axiosClassic, axiosFormData } from '@/api/interceptors'
import {
  ITag,
  ITagCreate,
  ITagRuleCatalog,
  ITagUpdate,
} from '@/interface/ITag'

// Людські назви для UI-конструктора правил
export const RULE_FIELD_LABELS: Record<string, string> = {
  totalHours: 'Відпрацьовано годин',
  startHour: 'Година початку',
  endHour: 'Година завершення',
  weekday: 'День тижня (1–7)',
  late: 'Запізнення',
  offSchedule: 'Поза графіком',
  isDayOff: 'Вихідний за графіком',
  status: 'Статус зміни',
  departmentId: 'Відділення (id)',
}
export const RULE_OP_LABELS: Record<string, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'у списку',
}
export const RULE_TRIGGER_LABELS: Record<string, string> = {
  SHIFT_STARTED: 'На початок зміни',
  SHIFT_ENDED: 'На завершення зміни',
}
export const RULE_ACTION_LABELS: Record<string, string> = {
  NOTIFY_USER: 'Сповістити працівника',
  NOTIFY_MANAGERS: 'Сповістити менеджерів',
}

class TagService {
  private BASE_URL = '/shift-tag'

  async getAll() {
    const response = await axiosClassic.get<ITag[]>(this.BASE_URL)
    return response.data
  }

  // Довідник для конструктора правил (потребує MANAGE_TAGS)
  async getRuleCatalog() {
    const response = await axiosClassic.get<ITagRuleCatalog>(
      `${this.BASE_URL}/rule-catalog`
    )
    return response.data
  }

  async getById(id: number) {
    const response = await axiosClassic.get<ITag>(`${this.BASE_URL}/${id}`)
    return response.data
  }

  async create(data: ITagCreate) {
    const response = await axiosClassic.post<ITag>(this.BASE_URL, data)
    return response.data
  }

  async update(id: number, data: ITagUpdate) {
    const response = await axiosClassic.put<ITag>(
      `${this.BASE_URL}/${id}`,
      data
    )
    return response.data
  }

  async delete(id: number) {
    const response = await axiosClassic.delete<ITag>(`${this.BASE_URL}/${id}`)
    return response.data
  }
}

export const tagService = new TagService()