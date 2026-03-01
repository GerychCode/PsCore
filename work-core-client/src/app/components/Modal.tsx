'use client'

import ReactModal from 'react-modal'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

const MyModal = ({ isOpen, onClose, children }: ModalProps) => {
  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={onClose}
      // Прибрали mt-22 та mx-auto, додали w-full та outline-none
      className='w-full max-w-200 rounded-2xl bg-white shadow-sm p-6 border-1 border-secondary/10 outline-none'
      // Додали flex items-center justify-center та p-4 для відступів на мобільних
      overlayClassName='fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4'
    >
      {children}
    </ReactModal>
  )
}

export default MyModal
