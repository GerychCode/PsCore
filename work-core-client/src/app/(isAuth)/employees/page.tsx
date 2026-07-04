'use client'

import React, { useEffect } from 'react'
import EmployeeBlock from '@/app/(isAuth)/employees/employee.block'
import { IUser } from '@/interface/IUser'
import { useGetUserListMutation } from '@/hooks/user/get.user.list.mutation'
import { useRouter } from 'next/navigation'
import { PathConfig } from '@/config/path.config'
import { userStore } from '@/store/user.store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  employeeLevelService,
  IEmployeeLevel,
} from '@/service/employee.level.service'
import { userService } from '@/service/user.service'
import { rolesService } from '@/service/roles.service'

const Page = () => {
  const user = userStore((state) => state.user)
  const isAdmin = userStore((state) => state.isAdmin)
  const hasPermission = userStore((state) => state.hasPermission)
  const canManageRoles = hasPermission('MANAGE_ROLES')
  const { mutate: fetchUsers, isPending, users } = useGetUserListMutation()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Рівні доступні тим, хто керує користувачами
  const { data: rankingResponse } = useQuery({
    queryKey: ['employee-levels'],
    queryFn: () => employeeLevelService.getRanking(),
    enabled: hasPermission('MANAGE_USERS'),
  })

  // Список ролей для призначення — лише для тих, хто керує ролями
  const { data: rolesResponse } = useQuery({
    queryKey: ['all-roles'],
    queryFn: () => rolesService.getAll(),
    enabled: canManageRoles,
  })

  const levelByUserId = new Map<number, IEmployeeLevel>(
    (rankingResponse?.data ?? []).map((level) => [level.userId, level])
  )

  const handleBaseLevelSave = async (userId: number, baseLevel: number) => {
    try {
      await userService.updateUserAdmin(userId, { baseLevel })
      toast.success('Базовий рівень оновлено')
      queryClient.invalidateQueries({ queryKey: ['employee-levels'] })
      fetchUsers()
    } catch (error: any) {
      toast.error(
        error?.response?.data?.errors?.[0]?.message ??
          'Не вдалося оновити рівень'
      )
    }
  }

  return (
      <div className='p-4 sm:p-6'>
        {isPending && (
            <p className='text-gray-500 text-center'>Завантаження користувачів...</p>
        )}
        <div className='grid gap-6 grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]'>
          {users?.map((employee: IUser) => (
              <EmployeeBlock
                  onClick={() => {
                    if (user?.id === employee.id) router.push(PathConfig.PROFILE)
                    else router.push(`${PathConfig.PROFILE_BY_ID}/${employee.id}`)
                  }}
                  key={employee.id}
                  user={employee}
                  level={levelByUserId.get(employee.id)}
                  canEditLevel={isAdmin && employee.id !== user?.id}
                  onBaseLevelSave={handleBaseLevelSave}
                  canManageRoles={canManageRoles}
                  allRoles={rolesResponse?.data ?? []}
              />
          ))}
        </div>
      </div>
  )
}

export default Page
