import { Injectable, NotFoundException } from '@nestjs/common';
import { startOfDay } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScheduleWishService {
  constructor(private readonly prismaService: PrismaService) {}

  async getMyWishes(userId: number, from?: string, to?: string) {
    return this.prismaService.scheduleWish.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              date: {
                ...(from && { gte: new Date(from) }),
                ...(to && { lte: new Date(to) }),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Побажання вихідного на конкретний день. Ідемпотентно —
   * повторний виклик просто повертає наявний запис (unique userId+date).
   */
  async addWish(userId: number, date: string) {
    const day = startOfDay(new Date(date));
    return this.prismaService.scheduleWish.upsert({
      where: { userId_date: { userId, date: day } },
      update: {},
      create: { userId, date: day },
    });
  }

  async removeWish(userId: number, id: number) {
    // deleteMany з фільтром по userId — щоб не видалити чуже побажання
    const result = await this.prismaService.scheduleWish.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Побажання не знайдено.');
    }
    return { success: true };
  }

  async removeWishByDate(userId: number, date: string) {
    const day = startOfDay(new Date(date));
    const result = await this.prismaService.scheduleWish.deleteMany({
      where: { userId, date: day },
    });
    return { success: result.count > 0 };
  }
}
