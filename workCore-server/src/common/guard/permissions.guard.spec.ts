import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '../permissions/permission.enum';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const ctx = (user: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => null,
      getClass: () => null,
    }) as any;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(reflector as any);
  });

  it('пропускає, якщо права не вимагаються', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(ctx({ role: 'Employe' }))).toBe(true);
  });

  it('пропускає адміна (enum) на будь-яке право', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.MANAGE_ROLES]);
    expect(guard.canActivate(ctx({ role: 'Admin' }))).toBe(true);
  });

  it('пропускає користувача з потрібним правом через роль', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.MANAGE_TAGS]);
    const user = {
      role: 'Employe',
      appRoles: [{ permissions: [Permission.MANAGE_TAGS] }],
    };
    expect(guard.canActivate(ctx(user))).toBe(true);
  });

  it('блокує без потрібного права', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.MANAGE_USERS]);
    const user = {
      role: 'Employe',
      appRoles: [{ permissions: [Permission.MANAGE_TAGS] }],
    };
    expect(() => guard.canActivate(ctx(user))).toThrow(ForbiddenException);
  });

  it('вимагає ВСІ перелічені права', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.MANAGE_USERS,
      Permission.MANAGE_ROLES,
    ]);
    const user = {
      role: 'Employe',
      appRoles: [{ permissions: [Permission.MANAGE_USERS] }],
    };
    expect(() => guard.canActivate(ctx(user))).toThrow(ForbiddenException);
  });
});
