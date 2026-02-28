import React from 'react'
import { IUser } from '@/interface/IUser'
import Avatar from '@/app/components/user/Avatar'
import { ImMail4 } from 'react-icons/im'

interface Props {
  user: IUser
  onClick?: () => void
}

const EmployeeBlock = ({ user, onClick }: Props) => {
  return (
      <div
          onClick={onClick}
          key={user.id}
          className='bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col items-center gap-4 cursor-pointer transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-1'
      >
        <div className='flex flex-col sm:flex-row items-center w-full gap-5 text-center sm:text-left'>
          <div className='flex-shrink-0'>
            <Avatar avatar={user.avatar ? user.avatar : undefined} size={6} />
          </div>
          <div className='flex flex-col justify-center w-full'>
            <h3 className='text-xl font-bold text-gray-800'>
              {user.firstName} {user.lastName}
            </h3>
            <p className='text-md text-gray-500'>{user?.email}</p>
            <p className='text-lg text-blue-600 font-semibold mt-1'>{user?.role}</p>
          </div>
        </div>
        {/*<div className="flex flex-row items-center w-full gap-3 mt-4 pt-4 border-t border-gray-200">*/}
        {/* <ImMail4 className="text-blue-600 text-2xl" />*/}
        {/* <p className="text-md text-gray-700">{user?.email}</p>*/}
        {/*</div>*/}
      </div>
  )
}

export default EmployeeBlock