import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
    (service as any).$connect = jest.fn().mockResolvedValue(undefined);
    (service as any).$disconnect = jest.fn().mockResolvedValue(undefined);
  });

  it('підключається до БД при ініціалізації модуля', async () => {
    await service.onModuleInit();
    expect((service as any).$connect).toHaveBeenCalled();
  });

  it('відключається від БД при знищенні модуля', async () => {
    await service.onModuleDestroy();
    expect((service as any).$disconnect).toHaveBeenCalled();
  });
});
