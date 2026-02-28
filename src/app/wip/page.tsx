import React from 'react'

const WorkInProgressPage = () => {
    return (
        <main className='flex items-center justify-center min-h-screen bg-gray-100'>
            <div className='text-center p-10 bg-white rounded-2xl shadow-md max-w-lg mx-auto'>
                <h1 className='text-4xl font-bold text-gray-800 mb-4'>Щось готується...</h1>
                <p className='text-lg text-secondary'>
                    Версія для вашого пристрою ще в розробці.
                </p>
                <p className='text-lg text-secondary mt-2'>
                    Будь ласка, спробуйте зайти з іншого пристрою або повертайтеся пізніше!
                </p>
            </div>
        </main>
    )
}

export default WorkInProgressPage