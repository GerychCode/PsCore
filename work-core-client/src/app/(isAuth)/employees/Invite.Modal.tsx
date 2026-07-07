'use client'
import React, { useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import MyModal from '@/app/components/Modal'
import InputComponent from '@/app/components/forms/InputComponent'
import { invitationService, IInvitationResult } from '@/service/invitation.service'
import { toast } from 'sonner'
import axios from 'axios'
import { FaCopy, FaEnvelope, FaCheck } from 'react-icons/fa'

interface Props {
  isOpen: boolean
  onClose: () => void
  onInvited?: () => void
}

type Inputs = { firstName: string; lastName: string; email: string }

export default function InviteModal({ isOpen, onClose, onInvited }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Inputs>()

  const [result, setResult] = useState<IInvitationResult | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)

  const close = () => {
    reset()
    setResult(null)
    setCopied(false)
    onClose()
  }

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsPending(true)
    try {
      const res = await invitationService.create(data)
      setResult(res.data)
      onInvited?.()
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ||
          error.response?.data?.errors?.[0]?.message
        : null
      toast.error(message || 'Не вдалося створити запрошення.')
    } finally {
      setIsPending(false)
    }
  }

  const copyLink = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.registrationLink)
      setCopied(true)
      toast.success('Посилання скопійовано')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Не вдалося скопіювати')
    }
  }

  const sendEmail = async () => {
    if (!result) return
    setSending(true)
    try {
      await invitationService.sendEmail(result.userId)
      toast.success('Запрошення надіслано на пошту')
    } catch {
      toast.error('Не вдалося надіслати лист')
    } finally {
      setSending(false)
    }
  }

  return (
    <MyModal isOpen={isOpen} onClose={close}>
      <div className='flex flex-col gap-6 w-full'>
        <h1 className='text-2xl font-semibold text-black'>
          Запросити співробітника
        </h1>

        {!result ? (
          <form className='flex flex-col gap-5' onSubmit={handleSubmit(onSubmit)}>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
              <InputComponent
                {...register('firstName', { required: 'Обов`язкове поле' })}
                errors={errors.firstName?.message}
                label="Ім'я"
                placeholder="Ім'я"
              />
              <InputComponent
                {...register('lastName', { required: 'Обов`язкове поле' })}
                errors={errors.lastName?.message}
                label='Прізвище'
                placeholder='Прізвище'
              />
            </div>
            <InputComponent
              {...register('email', {
                required: 'Обов`язкове поле',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Неправильний формат пошти',
                },
              })}
              errors={errors.email?.message}
              label='Email'
              placeholder='employee@example.com'
            />
            <div className='flex justify-end gap-2'>
              <button
                type='button'
                onClick={close}
                className='rounded-2xl border-2 border-gray-200 px-4 py-2.5 font-medium'
              >
                Відміна
              </button>
              <button
                type='submit'
                disabled={isPending}
                className='rounded-2xl bg-primary text-white px-5 py-2.5 font-medium hover:opacity-90 disabled:opacity-50'
              >
                {isPending ? 'Створюємо...' : 'Надіслати запрошення'}
              </button>
            </div>
          </form>
        ) : (
          <div className='flex flex-col gap-5'>
            <p className='text-sm text-gray-600'>
              Запрошення для{' '}
              <b>
                {result.firstName} {result.lastName}
              </b>{' '}
              створено. Надішліть користувачу посилання для реєстрації:
            </p>

            <div className='flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3'>
              <input
                readOnly
                value={result.registrationLink}
                className='flex-grow bg-transparent text-sm text-gray-700 focus:outline-none truncate'
              />
              <button
                onClick={copyLink}
                className='shrink-0 flex items-center gap-1.5 text-sm font-medium text-white bg-primary rounded-lg px-3 py-2 hover:opacity-90'
              >
                {copied ? <FaCheck size={12} /> : <FaCopy size={12} />}
                {copied ? 'Скопійовано' : 'Копіювати'}
              </button>
            </div>

            <div className='flex justify-between items-center'>
              <button
                onClick={sendEmail}
                disabled={sending}
                className='flex items-center gap-2 text-sm font-medium text-primary hover:opacity-75 disabled:opacity-50'
              >
                <FaEnvelope size={13} />
                {sending ? 'Надсилаємо...' : 'Відправити на пошту'}
              </button>
              <button
                onClick={close}
                className='rounded-2xl bg-primary text-white px-5 py-2.5 font-medium hover:opacity-90'
              >
                Готово
              </button>
            </div>
          </div>
        )}
      </div>
    </MyModal>
  )
}
