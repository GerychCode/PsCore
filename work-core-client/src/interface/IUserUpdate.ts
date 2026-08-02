
export interface IUserUpdate {
  firstName?: string
  lastName?: string
  email?: string
  dateOfBirth?: string
  phone?: string
  address?: string
  // avatar НЕ входить у профільний PUT — оновлюється лише через /user/avatar
}
