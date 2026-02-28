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
          className='mx-auto max-w-200 rounded-2xl mt-22 bg-white shadow-sm p-6 border-1 border-secondary/10 gap-4'
          overlayClassName='fixed inset-0 bg-black/50 backdrop-blur-xs z-50'
      >
        {children}
      </ReactModal>
  )
}

export default MyModal