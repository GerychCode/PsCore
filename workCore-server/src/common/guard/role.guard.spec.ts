import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './role.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const ctxWith = (request: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => null,
      getClass: () => null,
    }) as any;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as any);
  });

  it('пропускає, якщо ролі не задані', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(
      guard.canActivate(ctxWith({ user: { role: 'Employe' } })),
    ).resolves.toBe(true);
  });

  it('пропускає користувача з дозволеною роллю', async () => {
    reflector.getAllAndOverride.mockReturnValue(['Admin']);
    await expect(
      guard.canActivate(ctxWith({ user: { role: 'Admin' } })),
    ).resolves.toBe(true);
  });

  it('забороняє користувачу без потрібної ролі', async () => {
    reflector.getAllAndOverride.mockReturnValue(['Admin']);
    await expect(
      guard.canActivate(ctxWith({ user: { role: 'Employe' } })),
    ).rejects.toThrow(ForbiddenException);
  });
});
