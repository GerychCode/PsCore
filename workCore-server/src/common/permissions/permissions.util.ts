import { ALL_PERMISSIONS, Permission } from './permission.enum';

interface UserWithRoles {
  role?: string | null;
  appRoles?: { permissions: string[]; position?: number }[] | null;
}

/**
 * Обчислює повний набір прав користувача:
 * - enum role === 'Admin' → усі права (сумісність зі старою системою);
 * - інакше обʼєднання прав усіх призначених ролей;
 * - роль із ADMINISTRATOR → усі права.
 */
export function resolvePermissions(user: UserWithRoles): Set<string> {
  if (user?.role === 'Admin') {
    return new Set(ALL_PERMISSIONS);
  }

  const perms = new Set<string>();
  for (const role of user?.appRoles ?? []) {
    for (const p of role.permissions ?? []) {
      perms.add(p);
    }
  }

  if (perms.has(Permission.ADMINISTRATOR)) {
    return new Set(ALL_PERMISSIONS);
  }
  return perms;
}

export function hasPermission(
  user: UserWithRoles,
  permission: Permission,
): boolean {
  return resolvePermissions(user).has(permission);
}

/** Повний адмін (enum Admin або роль з ADMINISTRATOR) — обходить ієрархію ролей. */
export function isFullAdmin(user: UserWithRoles): boolean {
  return resolvePermissions(user).has(Permission.ADMINISTRATOR);
}

/**
 * Найвища позиція серед ролей користувача. Повний адмін = +∞
 * (може керувати будь-якою роллю). Без ролей = -∞ (не керує нічим).
 */
export function maxRolePosition(user: UserWithRoles): number {
  if (isFullAdmin(user)) return Number.POSITIVE_INFINITY;
  const positions = (user?.appRoles ?? []).map((r) => r.position ?? 0);
  return positions.length ? Math.max(...positions) : Number.NEGATIVE_INFINITY;
}
