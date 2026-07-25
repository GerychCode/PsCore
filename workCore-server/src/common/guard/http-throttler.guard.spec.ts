import { ThrottlerGuard } from '@nestjs/throttler';
import { HttpThrottlerGuard } from './http-throttler.guard';

describe('HttpThrottlerGuard', () => {
  // Object.create — щоб оминути конструктор ThrottlerGuard (потребує залежностей)
  const guard = Object.create(
    HttpThrottlerGuard.prototype,
  ) as HttpThrottlerGuard;

  const ctx = (type: string): any => ({ getType: () => type });

  afterEach(() => jest.restoreAllMocks());

  it('не-HTTP контекст пропускається без тротлінгу', async () => {
    const spy = jest.spyOn(ThrottlerGuard.prototype, 'canActivate');
    await expect(guard.canActivate(ctx('ws'))).resolves.toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('HTTP контекст делегує базовому ThrottlerGuard', async () => {
    const spy = jest
      .spyOn(ThrottlerGuard.prototype, 'canActivate')
      .mockResolvedValue(true);
    await expect(guard.canActivate(ctx('http'))).resolves.toBe(true);
    expect(spy).toHaveBeenCalled();
  });
});
