import { NotFoundException } from '@nestjs/common';
import { ScheduleWishService } from './schedule.wish.service';

describe('ScheduleWishService', () => {
  let service: ScheduleWishService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      scheduleWish: {
        findMany: jest.fn().mockResolvedValue([{ id: 1 }]),
        upsert: jest.fn().mockResolvedValue({ id: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new ScheduleWishService(prisma);
  });

  describe('getMyWishes', () => {
    it('без діапазону', async () => {
      await service.getMyWishes(1);
      expect(prisma.scheduleWish.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } }),
      );
    });

    it('з діапазоном from/to', async () => {
      await service.getMyWishes(1, '2026-06-01', '2026-06-30');
      const arg = prisma.scheduleWish.findMany.mock.calls[0][0];
      expect(arg.where.date).toBeDefined();
    });
  });

  it('addWish робить upsert', async () => {
    await service.addWish(1, '2026-06-01');
    expect(prisma.scheduleWish.upsert).toHaveBeenCalled();
  });

  describe('removeWish', () => {
    it('видаляє власне побажання', async () => {
      prisma.scheduleWish.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.removeWish(1, 9)).resolves.toEqual({ success: true });
    });

    it('чуже/неіснуюче → NotFound', async () => {
      prisma.scheduleWish.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.removeWish(1, 9)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeWishByDate', () => {
    it('success=true коли щось видалено', async () => {
      prisma.scheduleWish.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.removeWishByDate(1, '2026-06-01')).resolves.toEqual({
        success: true,
      });
    });

    it('success=false коли нічого не видалено', async () => {
      prisma.scheduleWish.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.removeWishByDate(1, '2026-06-01')).resolves.toEqual({
        success: false,
      });
    });
  });
});
