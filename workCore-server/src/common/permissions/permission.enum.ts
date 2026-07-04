/**
 * Права доступу (Discord-подібні прапорці). Роль містить набір цих прав,
 * права користувача = обʼєднання прав усіх його ролей.
 */
export enum Permission {
  ADMINISTRATOR = 'ADMINISTRATOR', // повний доступ (обходить решту перевірок)
  MANAGE_ROLES = 'MANAGE_ROLES', // керування ролями та їх призначенням
  MANAGE_USERS = 'MANAGE_USERS', // редагування/видалення користувачів, baseLevel
  MANAGE_DEPARTMENTS = 'MANAGE_DEPARTMENTS', // CRUD відділень, штат, склад
  MANAGE_SCHEDULE = 'MANAGE_SCHEDULE', // генерація/публікація графіка, лок тижнів
  APPROVE_SHIFTS = 'APPROVE_SHIFTS', // підтвердження/відхилення чужих змін
  MANAGE_TAGS = 'MANAGE_TAGS', // CRUD тегів змін
  VIEW_ALL_PROFILES = 'VIEW_ALL_PROFILES', // перегляд чутливих полів усіх профілів
}

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

/** Права, доступні для призначення ролі (усі, крім самого ADMINISTRATOR-опису? ні — включно). */
export const ASSIGNABLE_PERMISSIONS: Permission[] = ALL_PERMISSIONS;
