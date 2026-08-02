import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { addDays, endOfDay, format, getISODay, startOfDay } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftSessionService } from './shift.session.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.actions';
import { SYSTEM_TAGS } from '../work.shift.tag/system-tags';
import { TagRuleEngine } from '../work.shift.tag/tag-rule.engine';
import { $Enums, WorkShift } from '../../generated/prisma';

/**
 * Опівночі завершує зміни, які працівник забув закрити (endTime='').
 * Час завершення:
 *  - за графіком, якщо на цей день є запланована зміна;
 *  - інакше (поза графіком) — +10 годин від початку.
 * Планувальник — самопереплановуваний setTimeout (без зовнішньої залежності).
 */
@Injectable()
export class ShiftAutoCloseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ShiftAutoClose');
  private timer: NodeJS.Timeout | null = null;
  private readonly OFF_SCHEDULE_HOURS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftSession: ShiftSessionService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly tagRuleEngine: TagRuleEngine,
  ) {}

  onModuleInit() {
    this.scheduleNextRun();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private msUntilNextMidnight(now = new Date()): number {
    const next = new Date(now);
    // 00:00:05 наступного дня — невеликий буфер, щоб дата вже перегорнулась
    next.setHours(24, 0, 5, 0);
    return next.getTime() - now.getTime();
  }

  private scheduleNextRun() {
    const delay = this.msUntilNextMidnight();
    this.timer = setTimeout(() => {
      this.closeActiveShifts()
        .catch((e) =>
          this.logger.error(`Авто-завершення впало: ${(e as Error).message}`),
        )
        .finally(() => this.scheduleNextRun());
    }, delay);
    // Не тримати процес живим лише заради таймера
    this.timer.unref?.();
  }

  /**
   * Завершує всі активні зміни. Публічний — можна викликати вручну
   * (адмін-кнопка / тест).
   */
  async closeActiveShifts(now = new Date()): Promise<{ closed: number }> {
    const active = await this.prisma.workShift.findMany({
      where: { endTime: '' },
    });

    let closed = 0;
    for (const shift of active) {
      try {
        await this.closeShift(shift, now);
        closed += 1;
      } catch (e) {
        this.logger.warn(
          `Не вдалося авто-завершити зміну ${shift.id}: ${(e as Error).message}`,
        );
      }
    }

    if (closed > 0) {
      this.logger.log(`Авто-завершено ${closed} активних змін.`);
    }
    return { closed };
  }

  private async closeShift(shift: WorkShift, now: Date) {
    const schedule = await this.prisma.workSchedule.findFirst({
      where: {
        userId: shift.userId,
        date: { gte: startOfDay(shift.date), lte: endOfDay(shift.date) },
      },
    });

    const start = this.buildDateTime(shift.date, shift.startedAt);
    const offSchedule = !(schedule && !schedule.isDayOff && schedule.endTime);

    let end: Date;
    if (!offSchedule) {
      end = this.buildDateTime(shift.date, schedule!.endTime);
      // Нічна зміна: плановий кінець раніше старту → це вже наступний день
      if (end <= start) end = addDays(end, 1);
    } else {
      end = new Date(start.getTime() + this.OFF_SCHEDULE_HOURS * 3_600_000);
    }
    // Страховка від некоректного графіка. Недосяжна за валідних даних
    // (нічну зміну вже перенесено addDays), лишається як захист.
    /* istanbul ignore next */
    if (end <= start) {
      end = new Date(start.getTime() + this.OFF_SCHEDULE_HOURS * 3_600_000);
    }

    const totalHours = Math.max(
      Number(((end.getTime() - start.getTime()) / 3_600_000).toFixed(2)),
      0,
    );
    const endTime = format(end, 'HH:mm');

    // Теги: «Автозавершено» + «Без підтвердження виходу»
    const tagRecords = await Promise.all([
      this.shiftSession.getSystemTag(SYSTEM_TAGS.AUTO_CLOSED),
      this.shiftSession.getSystemTag(SYSTEM_TAGS.NO_CHECKOUT),
    ]);

    await this.prisma.workShift.update({
      where: { id: shift.id },
      data: {
        endTime,
        totalHours,
        tags: { connect: tagRecords.map((t) => ({ id: t.id })) },
      },
    });

    await this.notifications.createNotification(shift.userId, {
      title: 'Зміну завершено автоматично',
      message:
        `Ви не завершили зміну вручну — її закрито о ${endTime} ` +
        `(${totalHours} год, ${offSchedule ? 'поза графіком, +10 год' : 'за графіком'}). ` +
        'Якщо час невірний — зверніться до адміністратора.',
      type: $Enums.NotificationType.WARNING,
      category: 'shift',
    });

    await this.audit.log({
      actorId: null, // системна дія
      action: AuditAction.SHIFT_AUTO_CLOSED,
      entity: 'WorkShift',
      entityId: shift.id,
      metadata: {
        userId: shift.userId,
        endTime,
        totalHours,
        offSchedule,
      },
    });

    // Кастомні правила «на завершення зміни»
    await this.tagRuleEngine.apply('SHIFT_ENDED', shift.id, {
      userId: shift.userId,
      departmentId: shift.departmentId,
      totalHours,
      startHour: parseInt(shift.startedAt.split(':')[0], 10),
      endHour: parseInt(endTime.split(':')[0], 10),
      weekday: getISODay(shift.date),
      late:
        !offSchedule &&
        !!schedule &&
        shift.startedAt > (schedule.startedAt ?? ''),
      offSchedule,
      isDayOff: !!schedule?.isDayOff,
      status: shift.status,
    });

    await this.shiftSession.notifyShiftChanged(shift.userId);
  }

  private buildDateTime(date: Date, hhmm: string): Date {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  }
}
