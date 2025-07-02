export interface IUserLogin {
  email: string;
  password: string;
}

export interface IUserRegister {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  avatar?: string;
  // role?: 'Admin' | 'Manager' | 'Employe'; // якщо активуєш на бекенді
  // dateOfBirth?: string;
}
