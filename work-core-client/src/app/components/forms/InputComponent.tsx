import React, { useEffect, useId, useRef, useState } from 'react'
import Image, { StaticImageData } from 'next/image'
import { MdOutlineVisibility, MdOutlineVisibilityOff } from 'react-icons/md'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { FaCalendarAlt, FaClock } from 'react-icons/fa'

interface IInput {
    id?: string
    label?: string | null
    defaultValue?: string
    name?: string | null
    type?:
        | 'text'
        | 'password'
        | 'email'
        | 'number'
        | 'tel'
        | 'url'
        | 'date'
        | 'time'
        | 'datetime-local'
    ico?: StaticImageData | string | null
    errors?: string | null
    placeholder?: string
    onSelect?: (date: any) => void
    calendarPlacement?: 'top' | 'bottom' // Новий проп для керування позицією
}

const InputComponent = React.forwardRef<HTMLInputElement, IInput>(
    (
        {
            id: customId,
            label = null,
            name = null,
            defaultValue = '',
            type = 'text',
            ico = null,
            errors = null,
            placeholder = '',
            onSelect,
            calendarPlacement = 'bottom', // За замовчуванням вниз
            ...inputProps
        },
        ref
    ) => {
        const defaultId = useId()
        const id = customId || defaultId
        const [isVisiblePassword, setIsVisiblePassword] = useState(false)
        const [showCalendar, setShowCalendar] = useState(false)
        const [selectedDate, setSelectedDate] = useState<Date | undefined>(
            defaultValue && type === 'date' ? new Date(defaultValue) : undefined
        )

        const wrapperRef = useRef<HTMLDivElement>(null)

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (
                    wrapperRef.current &&
                    !wrapperRef.current.contains(event.target as Node)
                ) {
                    setShowCalendar(false)
                }
            }

            document.addEventListener('mousedown', handleClickOutside)
            return () => {
                document.removeEventListener('mousedown', handleClickOutside)
            }
        }, [])

        const handleDateSelect = (date: Date | undefined) => {
            setSelectedDate(date)
            setShowCalendar(false)
            if (onSelect) {
                onSelect(date ? format(date, 'yyyy-MM-dd') : undefined)
            }
        }

        const formattedDate =
            selectedDate instanceof Date && !isNaN(selectedDate.getTime())
                ? format(selectedDate, 'yyyy-MM-dd')
                : ''

        let trailingIcon = null
        if (type === 'password') {
            trailingIcon = (
                <button
                    type='button'
                    onClick={() => setIsVisiblePassword((prev) => !prev)}
                    className='focus:outline-none'
                >
                    {isVisiblePassword ? (
                        <MdOutlineVisibility className='text-2xl hover:opacity-75' />
                    ) : (
                        <MdOutlineVisibilityOff className='text-2xl hover:opacity-75' />
                    )}
                </button>
            )
        } else if (type === 'date') {
            trailingIcon = <FaCalendarAlt className='text-secondary text-xl hover:opacity-75' />
        } else if (type === 'time') {
            trailingIcon = <FaClock className='text-secondary text-xl hover:opacity-75' />
        }

        // Класи для позиціонування календаря
        const calendarPositionClasses =
            calendarPlacement === 'top'
                ? 'bottom-full mb-2' // Відкриваємо вгору
                : 'top-full mt-2'    // Відкриваємо вниз

        return (
            <section
                ref={wrapperRef}
                className='flex flex-col items-left w-full gap-1.5 relative'
            >
                {label && (
                    <div className='flex justify-between items-center mb-1'>
                        <label className='text-base font-medium' htmlFor={id}>
                            {label}
                        </label>
                        {errors && (
                            <span className='text-sm text-red-500 overflow-hidden text-ellipsis whitespace-nowrap'>
                {errors}
              </span>
                        )}
                    </div>
                )}

                <div
                    className={`h-12 w-full rounded-2xl border-2 border-gray-200 p-3 flex items-center gap-3 ${
                        type === 'date' && 'cursor-pointer'
                    }`}
                    onClick={() => {
                        if (type === 'date') setShowCalendar(true)
                    }}
                >
                    {ico && <Image width={24} height={24} src={ico} alt={type} />}

                    <input
                        className={`w-full bg-transparent outline-none ${type === 'date' ? 'cursor-pointer' : ''}`}
                        id={id}
                        name={name ?? ''}
                        placeholder={placeholder || (type === 'date' ? 'Оберіть дату' : '')}
                        type={type === 'password' && isVisiblePassword ? 'text' : (type === 'date' ? 'text' : type)}
                        value={type === 'date' ? (formattedDate || defaultValue) : undefined}
                        defaultValue={type !== 'date' ? defaultValue : undefined}
                        readOnly={type === 'date'}
                        ref={ref}
                        {...inputProps}
                    />

                    {trailingIcon}
                </div>

                {type === 'date' && showCalendar && (
                    <div className={`absolute ${calendarPositionClasses} left-0 z-50 bg-white border-2 border-gray-200 rounded-xl shadow-lg p-2 max-w-[90vw] sm:max-w-none overflow-auto`}>
                        <DayPicker
                            mode='single'
                            animate
                            captionLayout='dropdown'
                            fromYear={1900}
                            toYear={new Date().getFullYear()}
                            selected={selectedDate}
                            onSelect={handleDateSelect}
                            locale={uk}
                        />
                    </div>
                )}
            </section>
        )
    }
)

InputComponent.displayName = 'InputComponent'
export default InputComponent