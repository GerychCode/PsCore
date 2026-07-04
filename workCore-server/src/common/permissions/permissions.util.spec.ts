import { resolvePermissions, hasPermission } from './permissions.util';
import { ALL_PERMISSIONS, Permission } from './permission.enum';

describe('resolvePermissions', () => {
  it('enum Admin отримує всі права', () => {
    const perms = resolvePermissions({ role: 'Admin' });
    expect(perms.size).toBe(ALL_PERMISSIONS.length);
    expect(perms.has(Permission.MANAGE_ROLES)).toBe(true);
  });

  it('обʼєднує права всіх ролей', () => {
    const perms = resolvePermissions({
      role: 'Employe',
      appRoles: [
        { permissions: [Permission.MANAGE_TAGS] },
        { permissions: [Permission.MANAGE_DEPARTMENTS] },
      ],
    });
    expect(perms.has(Permission.MANAGE_TAGS)).toBe(true);
    expect(perms.has(Permission.MANAGE_DEPARTMENTS)).toBe(true);
    expect(perms.has(Permission.MANAGE_USERS)).toBe(false);
  });

  it('роль з ADMINISTRATOR дає всі права', () => {
    const perms = resolvePermissions({
      role: 'Employe',
      appRoles: [{ permissions: [Permission.ADMINISTRATOR] }],
    });
    expect(perms.size).toBe(ALL_PERMISSIONS.length);
  });

  it('користувач без ролей не має прав', () => {
    const perms = resolvePermissions({ role: 'Employe', appRoles: [] });
    expect(perms.size).toBe(0);
  });

  it('hasPermission коректно перевіряє', () => {
    const user = {
      role: 'Employe',
      appRoles: [{ permissions: [Permission.APPROVE_SHIFTS] }],
    };
    expect(hasPermission(user, Permission.APPROVE_SHIFTS)).toBe(true);
    expect(hasPermission(user, Permission.MANAGE_USERS)).toBe(false);
  });
});
