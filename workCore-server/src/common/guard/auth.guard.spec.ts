import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let userService: { findByIdWithRoles: jest.Mock };

  const ctxWith = (request: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as any;

  beforeEach(() => {
    userService = { findByIdWithRoles: jest.fn() };
    guard = new AuthGuard(userService as any);
  });

  it('кидає UnauthorizedException без userId у сесії', async () => {
    await expect(
      guard.canActivate(ctxWith({ session: {} })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('пропускає авторизованого користувача і додає його в request', async () => {
    userService.findByIdWithRoles.mockResolvedValue({
      id: 1,
      role: 'Admin',
      appRoles: [],
    });
    const request: any = { session: { userId: 1 } };

    const result = await guard.canActivate(ctxWith(request));

    expect(result).toBe(true);
    expect(request.user).toEqual({ id: 1, role: 'Admin', appRoles: [] });
  });
});
