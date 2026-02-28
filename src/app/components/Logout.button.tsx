import { FiLogOut } from 'react-icons/fi'
import { userLogoutMutation } from '@/hooks/user/user.logout.mutation'

export const LogoutButton = () => {
  const { mutate, isPending } = userLogoutMutation()

  return (
    <button
      onClick={() => mutate()}
      disabled={isPending}
      className='text-3xl hover:opacity-75 text-secondary'
    >
      <FiLogOut />
    </button>
  )
}
