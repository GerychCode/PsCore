import Image from 'next/image'
import { userStore } from '@/store/user.store'

interface IAvatar {
  avatar?: string
  size?: number
  preview?: boolean
}

export default function Avatar({
  avatar,
  size = 3.5,
  preview = false,
}: IAvatar) {
  const avatarPicture = preview
    ? avatar
    : avatar
      ? `${process.env.NEXT_PUBLIC_SERVER_FILE_STORAGE_PATH}/${avatar}`
      : '/test-ava.jpg'
  const remSize = `${size}rem`
  return (
    <div
      style={{ width: remSize, height: remSize }}
      className='relative rounded-full overflow-hidden flex items-center justify-center shadow-sm shrink-0'
    >
      {avatarPicture ? (
        <Image
          src={avatarPicture}
          alt='Avatar'
          fill
          className='object-cover'
          sizes='(max-width: 768px) 100vw, 50px'
        />
      ) : (
        <span className='text-gray-500 text-xs'>No image</span>
      )}
    </div>
  )
}
