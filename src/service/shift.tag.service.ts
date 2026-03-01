import { axiosClassic, axiosFormData } from '@/api/interceptors'
import { ITag, ITagCreate, ITagUpdate } from '@/interface/ITag'

class TagService {
  private BASE_URL = '/shift-tag'

  async getAll() {
    const response = await axiosClassic.get<ITag[]>(this.BASE_URL)
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