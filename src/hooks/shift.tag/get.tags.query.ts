import { useQuery } from '@tanstack/react-query'
import { tagService } from '@/service/shift.tag.service'

export const useGetTagsQuery = () => {
  return useQuery({
    queryKey: ['shift-tag'],
    queryFn: () => tagService.getAll(),
  })
}
