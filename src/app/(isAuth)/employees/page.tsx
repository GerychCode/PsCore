'use client'

import React, { useEffect } from 'react'
import EmployeeBlock from '@/app/(isAuth)/employees/employee.block'
import { IUser } from '@/interface/IUser'
import { useGetUserListMutation } from '@/hooks/user/get.user.list.mutation'
import { useRouter } from 'next/navigation'
import { PathConfig } from '@/config/path.config'
import { userStore } from '@/store/user.store'

const Page = () => {
  const user = userStore((state) => state.user)
  const { mutate: fetchUsers, isPending, users } = useGetUserListMutation()
  const router = useRouter()
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

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
              />
          ))}
        </div>
      </div>
  )
}

export default Page