import { BadRequestException, Injectable } from '@nestjs/common';
import { endOfDay, format, getISODay, startOfDay } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { EventsGateway } from '../events/events.gateway';
import { $Enums, WorkSchedule, WorkShift } from '../../generated/prisma';
import ShiftStatus = $Enums.ShiftStatus;
import {
  SYSTEM_TAGS,
  SystemTagSpec,
} from '../work.shift.tag/system-tags';
import { TagRuleEngine } from '../work.shift.tag/tag-rule.engine';
import { ShiftRuleContext } from '../work.shift.tag/tag-rule.types';

export type ShiftStartCheck =
  | { status: 'ALREADY_ACTIVE'; startedAt?: string }
  | { status: 'NO_SCHEDULE'; departments: { id: number; name: string }[] }
  | { status: 'NO_DEPARTMENT' }
  | { status: 'OVERLAP' }
  | {
      status: 'OK';
      departmentId: number;
      departmentName: string;
      departmentTelegramId: string | null;
      offSchedule: boolean;
    };

export type StartShiftResult =
  | Exclude<ShiftStartCheck, { status: 'OK' }>
  | {
      status: 'STARTED';
      time: string;
      departmentName: string;
      scheduledStart?: string;
      scheduledEnd?: string;
      late: boolean;
      offSchedule: boolean;
    };

export type EndShiftResult =
  | { status: 'NO_ACTIVE' }
  | {
      status: 'ENDED';
      time: string;
      startedAt: string;
      totalHours: number;
    };

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
    private readonly tagRuleEngine: TagRuleEngine,
  ) {}

  /**
   * Гарантує існування системного тега з актуальними метаданими
   * (isSystem/color/description). upsert — щоб паралельні перші виклики
   * не падали на unique(name).
   */
  async getSystemTag(spec: SystemTagSpec) {
    return this.prismaService.tag.upsert({
      where: { name: spec.name },
      update: {
        isSystem: true,
        color: spec.color,
        description: spec.description,
      },
      create: {
        name: spec.name,
        severity: spec.severity,
        isSystem: true,
        color: spec.color,
        description: spec.description,
      },
    });
  }

  /**
   * Визначає системні теги зміни відносно розкладу. Теги комбінуються:
   * напр. вихідний + запізнення можуть висіти разом.
   */
  async resolveScheduleTags(
    schedule: WorkSchedule | null,
    startedAt: string,
  ): Promise<{ id: number }[]> {
    const specs: SystemTagSpec[] = [];

    if (!schedule) {
      specs.push(SYSTEM_TAGS.OFF_SCHEDULE);
    } else {
      if (schedule.isDayOff) specs.push(SYSTEM_TAGS.DAY_OFF);
      // startedAt/schedule.startedAt — рядки "HH:mm", лексикографічне порівняння коректне
      if (schedule.startedAt && startedAt > schedule.startedAt) {
        specs.push(SYSTEM_TAGS.LATE);
      }
    }

    const tags = await Promise.all(specs.map((s) => this.getSystemTag(s)));
    return tags.map((t) => ({ id: t.id }));
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

  /** Графік користувача на сьогодні (з назвою відділення). */
  private findTodaySchedule(userId: number, now: Date) {
    return this.prismaService.workSchedule.findFirst({
      where: {
        userId,
        date: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      include: {
        department: { select: { name: true, telegramId: true } },
      },
    });
  }

  /**
   * Перевіряє, чи може користувач почати зміну, не створюючи її.
   * Якщо на сьогодні немає графіка, повертає NO_SCHEDULE зі списком відділень
   * користувача; повторний виклик з offScheduleDepartmentId дає OK
   * (offSchedule = true).
   */
  async checkShiftStart(
    userId: number,
    offScheduleDepartmentId?: number,
  ): Promise<ShiftStartCheck> {
    const activeShift = await this.findActiveShift(userId);
    if (activeShift) {
      return { status: 'ALREADY_ACTIVE', startedAt: activeShift.startedAt };
    }

    const now = new Date();
    const schedule = await this.findTodaySchedule(userId, now);

    let departmentId: number;
    let departmentName: string;
    let departmentTelegramId: string | null;
    if (schedule) {
      departmentId = schedule.departmentId;
      departmentName = (schedule as any).department?.name ?? '—';
      departmentTelegramId = (schedule as any).department?.telegramId ?? null;
    } else {
      const departments = await this.prismaService.department.findMany({
        where: { members: { some: { id: userId } } },
        select: { id: true, name: true, telegramId: true },
      });
      if (!departments.length) return { status: 'NO_DEPARTMENT' };

      const chosen = departments.find((d) => d.id === offScheduleDepartmentId);
      if (!chosen) {
        return {
          status: 'NO_SCHEDULE',
          departments: departments.map(({ id, name }) => ({ id, name })),
        };
      }

      departmentId = chosen.id;
      departmentName = chosen.name;
      departmentTelegramId = chosen.telegramId;
    }

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

    return {
      status: 'OK',
      departmentId,
      departmentName,
      departmentTelegramId,
      offSchedule: !schedule,
    };
  }

  /**
   * Створює зміну після успішних перевірок. startedAt дозволяє зафіксувати
   * час початку раніше за момент виклику (напр., момент натискання кнопки
   * в боті, до проходження верифікації).
   */
  async startShift(
    userId: number,
    offScheduleDepartmentId?: number,
    startedAt?: Date,
  ): Promise<StartShiftResult> {
    const check = await this.checkShiftStart(userId, offScheduleDepartmentId);
    if (check.status !== 'OK') return check;

    const startMoment = startedAt ?? new Date();
    const schedule = await this.findTodaySchedule(userId, startMoment);
    const currentTime = format(startMoment, 'HH:mm');
    const tagsToConnect = await this.resolveScheduleTags(schedule, currentTime);

    // Атомарний старт: advisory-lock по userId серіалізує паралельні спроби
    // (веб+бот / подвійний тап), а повторна перевірка активної зміни всередині
    // транзакції прибирає TOCTOU-гонку «дві активні зміни».
    let createdShiftId: number | undefined;
    try {
      await this.prismaService.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${userId})`;
        const active = await tx.workShift.findFirst({
          where: { userId, endTime: '' },
          select: { id: true },
        });
        if (active) throw new Error('ALREADY_ACTIVE');
        const created = await tx.workShift.create({
          data: {
            userId,
            departmentId: check.departmentId,
            date: startMoment,
            startedAt: currentTime,
            endTime: '',
            totalHours: 0,
            status: ShiftStatus.PENDING,
            tags: { connect: tagsToConnect },
          },
        });
        createdShiftId = created.id;
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'ALREADY_ACTIVE') {
        return { status: 'ALREADY_ACTIVE' };
      }
      throw e;
    }

    // Кастомні правила «на початок зміни»
    if (createdShiftId) {
      const late =
        !!schedule && !schedule.isDayOff && currentTime > schedule.startedAt;
      const ctx: ShiftRuleContext = {
        userId,
        departmentId: check.departmentId,
        totalHours: 0,
        startHour: parseInt(currentTime.split(':')[0], 10),
        endHour: null,
        weekday: getISODay(startMoment),
        late,
        offSchedule: check.offSchedule,
        isDayOff: !!schedule?.isDayOff,
        status: ShiftStatus.PENDING,
      };
      await this.tagRuleEngine.apply('SHIFT_STARTED', createdShiftId, ctx);
    }

    await this.notifyShiftChanged(userId);
    return {
      status: 'STARTED',
      time: currentTime,
      departmentName: check.departmentName,
      scheduledStart: schedule?.startedAt,
      scheduledEnd: schedule?.endTime,
      late:
        !!schedule && !schedule.isDayOff && currentTime > schedule.startedAt,
      offSchedule: check.offSchedule,
    };
  }

  async endShift(userId: number): Promise<EndShiftResult> {
    const activeShift = await this.findActiveShift(userId);
    if (!activeShift) return { status: 'NO_ACTIVE' };

    const now = new Date();
    const endTime = format(now, 'HH:mm');

    // Рахуємо за повними датами-часами, а не за рядком HH:mm — інакше зміна
    // через північ (напр. 23:00→01:00) давала відʼємні хвилини → 0 годин.
    const [startHour, startMin] = activeShift.startedAt.split(':').map(Number);
    const start = new Date(activeShift.date);
    start.setHours(startHour, startMin, 0, 0);
    const totalHours = Math.max(
      Number(((now.getTime() - start.getTime()) / 3_600_000).toFixed(2)),
      0,
    );

    await this.prismaService.workShift.update({
      where: { id: activeShift.id },
      data: { endTime, totalHours },
    });

    // Кастомні правила «на завершення зміни»
    const scheduleForCtx = await this.prismaService.workSchedule.findFirst({
      where: {
        userId,
        date: {
          gte: startOfDay(activeShift.date),
          lte: endOfDay(activeShift.date),
        },
      },
    });
    const ctx: ShiftRuleContext = {
      userId,
      departmentId: activeShift.departmentId,
      totalHours,
      startHour,
      endHour: parseInt(endTime.split(':')[0], 10),
      weekday: getISODay(activeShift.date),
      late:
        !!scheduleForCtx &&
        !scheduleForCtx.isDayOff &&
        activeShift.startedAt > scheduleForCtx.startedAt,
      offSchedule: !scheduleForCtx,
      isDayOff: !!scheduleForCtx?.isDayOff,
      status: activeShift.status,
    };
    await this.tagRuleEngine.apply('SHIFT_ENDED', activeShift.id, ctx);

    await this.notifyShiftChanged(userId);
    return {
      status: 'ENDED',
      time: endTime,
      startedAt: activeShift.startedAt,
      totalHours,
    };
  }
}
