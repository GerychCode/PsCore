import React from 'react'
import { IDepartment } from '@/interface/IDepartment'
import { userStore } from '@/store/user.store'
import { FaEdit, FaMapMarkerAlt, FaClock } from 'react-icons/fa'

interface Props {
    department: IDepartment
    onEdit?: () => void
}

const DepartmentBlock = ({ department, onEdit }: Props) => {
    const isAdmin = userStore((state) => state.isAdmin)

    return (
        <div
            key={department.id}
            className='bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col gap-4 transition-all duration-300 ease-in-out hover:shadow-lg'
        >
            <div className='flex justify-between items-start'>
                <h3 className='text-xl font-bold text-gray-800'>{department.name}</h3>
                {isAdmin && (
                    <button onClick={onEdit} className='text-secondary hover:text-primary'>
                        <FaEdit />
                    </button>
                )}
            </div>
            <div className='flex flex-col gap-2'>
                <div className='flex items-center gap-2 text-gray-600'>
                    <FaMapMarkerAlt />
                    <span>{department.address || 'Адреса не вказана'}</span>
                </div>
                <div className='flex items-center gap-2 text-gray-600'>
                    <FaClock />
                    <span>Будні: {department.weekdaysOpeningTime} - {department.weekdaysClosingTime}</span>
                </div>
                <div className='flex items-center gap-2 text-gray-600'>
                    <FaClock />
                    <span>Вихідні: {department.weekendsOpeningTime} - {department.weekendsClosingTime}</span>
                </div>
            </div>
        </div>
    )
}

export default DepartmentBlock