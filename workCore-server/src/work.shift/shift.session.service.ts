import { BadRequestException, Injectable } from '@nestjs/common';
import { endOfDay, format, startOfDay } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { EventsGateway } from '../events/events.gateway';
import { $Enums, WorkSchedule, WorkShift } from '../../generated/prisma';
import ShiftStatus = $Enums.ShiftStatus;

export type StartShiftResult =
  | { status: 'ALREADY_ACTIVE' }
  | { status: 'NO_SCHEDULE' }
  | { status: 'OVERLAP' }
  | { status: 'STARTED'; time: string };

export type EndShiftResult =
  | { status: 'NO_ACTIVE' }
  | { status: 'ENDED'; time: string; totalHours: number };

/**
 * Спільна логіка життєвого циклу зміни (створення/початок/завершення),
 * яку використовують і REST API (WorkShiftService), і Telegram-бот.
 */
@Injectable()
export class ShiftSessionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async getSystemTag(name: string, severity: number) {
    let tag = await this.prismaService.tag.findUnique({ where: { name } });
    if (!tag) {
      tag = await this.prismaService.tag.create({ data: { name, severity } });
    }
    return tag;
  }

  /**
   * Визначає системні теги зміни відносно розкладу:
   * «Поза графіком», «У вихідний», «Запізнення».
   */
  async resolveScheduleTags(
    schedule: WorkSchedule | null,
    startedAt: string,
  ): Promise<{ id: number }[]> {
    if (!schedule) {
      const tag = await this.getSystemTag('Поза графіком', 2);
      return [{ id: tag.id }];
    }
    if (schedule.isDayOff) {
      const tag = await this.getSystemTag('У вихідний', 2);
      return [{ id: tag.id }];
    }
    if (startedAt > schedule.startedAt) {
      const tag = await this.getSystemTag('Запізнення', 2);
      return [{ id: tag.id }];
    }
    return [];
  }

  /** Кидає BadRequest, якщо інтервал перетинається з існуючими змінами дня. */
  validateNoOverlap(
    dayShifts: WorkShift[],
    startedAt: Date,
    endAt: Date,
    shiftId?: number,
  ) {
    dayShifts.forEach((day) => {
      // Незавершена зміна (endTime === '') не має валідного інтервалу
      if (!day.startedAt || !day.endTime) return;

      const [startHour, startMinute] = day.startedAt.split(':').map(Number);
      const [endHour, endMinute] = day.endTime.split(':').map(Number);

      const existingStart = new Date(day.date);
      existingStart.setHours(startHour, startMinute, 0, 0);

      const existingEnd = new Date(day.date);
      existingEnd.setHours(endHour, endMinute, 0, 0);

      const isOverlapping =
        (startedAt >= existingStart && startedAt < existingEnd) ||
        (endAt > existingStart && endAt <= existingEnd) ||
        (startedAt <= existingStart && endAt >= existingEnd);

      if (isOverlapping && shiftId !== day.id) {
        throw new BadRequestException(
          'Нова зміна перетинається з існуючою зміною!',
        );
      }
    });
  }

  findActiveShift(userId: number) {
    return this.prismaService.workShift.findFirst({
      where: { userId, endTime: '' },
    });
  }

  /** Сповіщає адмінів та власника зміни про необхідність оновити список. */
  async notifyShiftChanged(userId: number) {
    const adminIds = await this.userService.getAdmins();
    const usersToNotify = Array.from(new Set([...adminIds, userId]));
    this.eventsGateway.emitToUsers(usersToNotify, 'invalidate_shifts');
  }

  async startShift(userId: number): Promise<StartShiftResult> {
    const activeShift = await this.findActiveShift(userId);
    if (activeShift) return { status: 'ALREADY_ACTIVE' };

    const now = new Date();
    const schedule = await this.prismaService.workSchedule.findFirst({
      where: {
        userId,
        date: { gte: startOfDay(now), lte: endOfDay(now) },
      },
    });
    if (!schedule) return { status: 'NO_SCHEDULE' };

    const dayShifts = await this.prismaService.workShift.findMany({
      where: {
        userId,
        date: { gte: startOfDay(now), lte: endOfDay(now) },
      },
    });

    try {
      this.validateNoOverlap(dayShifts, now, now);
    } catch {
      return { status: 'OVERLAP' };
    }

    const currentTime = format(now, 'HH:mm');
    const tagsToConnect = await this.resolveScheduleTags(schedule, currentTime);

    await this.prismaService.workShift.create({
      data: {
        userId,
        departmentId: schedule.departmentId,
        date: now,
        startedAt: currentTime,
        endTime: '',
        totalHours: 0,
        status: ShiftStatus.PENDING,
        tags: { connect: tagsToConnect },
      },
    });

    await this.notifyShiftChanged(userId);
    return { status: 'STARTED', time: currentTime };
  }

  async endShift(userId: number): Promise<EndShiftResult> {
    const activeShift = await this.findActiveShift(userId);
    if (!activeShift) return { status: 'NO_ACTIVE' };

    const now = new Date();
    const endTime = format(now, 'HH:mm');

    const [startHour, startMin] = activeShift.startedAt.split(':').map(Number);
    const totalMinutes =
      now.getHours() * 60 + now.getMinutes() - (startHour * 60 + startMin);
    const totalHours = Math.max(Number((totalMinutes / 60).toFixed(2)), 0);

    await this.prismaService.workShift.update({
      where: { id: activeShift.id },
      data: { endTime, totalHours },
    });

    await this.notifyShiftChanged(userId);
    return { status: 'ENDED', time: endTime, totalHours };
  }
}
