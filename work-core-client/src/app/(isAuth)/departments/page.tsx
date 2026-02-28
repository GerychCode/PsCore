'use client'

import React, { useEffect, useState } from 'react'
import { useGetDepartmentListMutation } from '@/hooks/department/use-get-department-list.mutation'
import { userStore } from '@/store/user.store'
import DepartmentBlock from '@/app/(isAuth)/departments/department.block'
import { IDepartment } from '@/interface/IDepartment'
import DepartmentModal from '@/app/(isAuth)/departments/Department.Modal'
import { IoMdAdd } from 'react-icons/io'

const Page = () => {
    const isAdmin = userStore((state) => state.isAdmin)
    const { mutate: fetchDepartments, isPending, departments } = useGetDepartmentListMutation()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDepartment, setSelectedDepartment] = useState<IDepartment | null>(null)

    useEffect(() => {
        fetchDepartments()
    }, [fetchDepartments])

    const handleEdit = (department: IDepartment) => {
        setSelectedDepartment(department)
        setIsModalOpen(true)
    }

    const handleCreate = () => {
        setSelectedDepartment(null)
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setSelectedDepartment(null)
    }

    return (
        <div className='p-4 sm:p-6'>
            <div className='flex justify-end items-center mb-6'>

                {isAdmin && (
                    <button
                        onClick={handleCreate}
                        className='h-11 px-4 flex items-center gap-2 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:shadow-md hover:opacity-90 transition'
                    >
                        <IoMdAdd className='text-lg' />
                        Створити відділення
                    </button>
                )}
            </div>
            {isPending && (
                <p className='text-gray-500 text-center'>Завантаження відділень...</p>
            )}
            <div className='grid gap-6 grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]'>
                {departments?.map((department: IDepartment) => (
                    <DepartmentBlock
                        key={department.id}
                        department={department}
                        onEdit={() => handleEdit(department)}
                    />
                ))}
            </div>
            {isModalOpen && (
                <DepartmentModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    department={selectedDepartment}
                    onUpdate={fetchDepartments}
                />
            )}
        </div>
    )
}

export default Page