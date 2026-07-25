import * as bcrypt from 'bcrypt';
import { AdminBootstrapService } from './admin.bootstrap.service';

jest.mock('bcrypt');

describe('AdminBootstrapService', () => {
  let prisma: any;
  let config: any;

  beforeEach(() => {
    prisma = {
      user: {
        count: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };
    config = { get: jest.fn() };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
  });

  it('якщо користувачі вже є — нічого не створює', async () => {
    prisma.user.count.mockResolvedValue(3);
    const service = new AdminBootstrapService(prisma, config);
    await service.onModuleInit();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('порожня БД — створює суперадміна з дефолтною поштою', async () => {
    prisma.user.count.mockResolvedValue(0);
    config.get.mockReturnValue(undefined);
    const service = new AdminBootstrapService(prisma, config);
    await service.onModuleInit();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@workcore.local',
          role: 'Admin',
          mustChangePassword: true,
        }),
      }),
    );
  });

  it('використовує SUPERADMIN_EMAIL з конфігу', async () => {
    prisma.user.count.mockResolvedValue(0);
    config.get.mockReturnValue('boss@x.com');
    const service = new AdminBootstrapService(prisma, config);
    await service.onModuleInit();
    const arg = prisma.user.create.mock.calls[0][0];
    expect(arg.data.email).toBe('boss@x.com');
  });
});
