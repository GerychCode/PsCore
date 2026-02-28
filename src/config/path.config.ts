export enum PathConfig {
  AUTH = '/auth',
  HOME = '/',
  LOGIN = '/auth/login',
  REGISTER = '/auth/registration',
  LOGOUT = '/auth/logout',
  FORGOT_PASSWORD = '/auth/forgot-password',

  DASHBOARD = '/dashboard',
  PROFILE = '/profile',
  PROFILE_BY_ID = '/profile',
  EMPLOYEES = '/employees',
  SCHEDULE = '/schedule',
  DEPARTMENTS = '/departments',
  SETTINGS = '/settings',
}

export const routeLabels: Record<string, string> = {
  [PathConfig.HOME]: 'Головна',
  [PathConfig.LOGIN]: 'Вхід',
  [PathConfig.REGISTER]: 'Реєстрація',
  [PathConfig.DASHBOARD]: 'Панель',
  [PathConfig.PROFILE]: 'Профіль',
  [PathConfig.EMPLOYEES]: 'Працівники',
  [PathConfig.SCHEDULE]: 'Графік роботи',
  [PathConfig.DEPARTMENTS]: 'Відділення',
  [PathConfig.SETTINGS]: 'Налаштування',
}