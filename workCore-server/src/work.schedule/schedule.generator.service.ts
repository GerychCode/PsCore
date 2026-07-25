import { BadRequestException, Injectable } from '@nestjs/common';
import { eachDayOfInterval, formatISO, getISODay } from 'date-fns';
import { weekBounds } from '../common/utils/week.util';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeLevelService } from '../employee.level/employee.level.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const MAX_LEVEL = 10;

export interface GenMember {
  userId: number;
  level: number;
  reliability: number;
}

export interface GenDay {
  /** ISO день тижня: 1 = Пн … 7 = Нд */
  weekday: number;
  required: number;
  /** Зайняті цього дня будь-де (published або чернетка іншого відділу) — виключаємо */
  busyUserIds: number[];
  /** Скільки слотів цього відділу вже закрито (published-зміни саме цього відділу) */
  coveredCount: number;
  /** Користувачі, що хочуть цей день вихідним */
  wishUserIds: number[];
  /** Тривалість зміни цього дня в годинах (для рівномірності навантаження) */
  shiftHours: number;
}

export interface Assignment {
  userId: number;
  weekday: number;
}

export interface GenWarning {
  weekday: number;
  type: 'UNDERSTAFFED' | 'WISH_VIOLATED';
  message: string;
  userId?: number;
}

export interface GenResult {
  assignments: Assignment[];
  warnings: GenWarning[];
}

@Injectable()
export class ScheduleGeneratorService {
  // Порушити побажання можна лише коли інакше не закрити зміну
  private readonly WISH_PENALTY = 10000;
  // Рівномірність за годинами: ~10-годинна зміна ≈ повний розкид рівнів
  private readonly FAIRNESS_PER_HOUR = 10;
  private readonly LEVEL_WEIGHT = 10;
  private readonly RELIABILITY_WEIGHT = 0.5;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly employeeLevelService: EmployeeLevelService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Чисте ядро: розподіляє членів по днях тижня за жадібним скорингом.
   * Не торкається БД — легко тестується.
   */
  computeAssignments(days: GenDay[], members: GenMember[]): GenResult {
    const assignments: Assignment[] = [];
    const warnings: GenWarning[] = [];
    // Наростаючі відпрацьовані години на тижні — основа рівномірності
    const assignedHoursByUser = new Map<number, number>();

    const activeDays = days.filter((d) => d.required > 0);
    const avgRequired =
      activeDays.length > 0
        ? activeDays.reduce((sum, d) => sum + d.required, 0) / activeDays.length
        : 0;

    // Дні в порядку тижня — рівномірність рахується наростаючим підсумком
    const orderedDays = [...days].sort((a, b) => a.weekday - b.weekday);

    for (const day of orderedDays) {
      if (day.required <= 0) continue;

      const busy = new Set(day.busyUserIds);
      // Скільки цього відділу вже закрито published-змінами
      const remaining = day.required - day.coveredCount;
      if (remaining <= 0) continue;

      const wishSet = new Set(day.wishUserIds);
      const isPeak = day.required > avgRequired;

      const pool = members
        .filter((m) => !busy.has(m.userId))
        .map((m) => {
          const assignedHours = assignedHoursByUser.get(m.userId) ?? 0;
          let score = 0;

          if (wishSet.has(m.userId)) score -= this.WISH_PENALTY;
          score -= assignedHours * this.FAIRNESS_PER_HOUR;
          // Пікові дні тягнуть сильних; спокійні — ротація нижчих рівнів
          score += isPeak
            ? m.level * this.LEVEL_WEIGHT
            : (MAX_LEVEL - m.level) * this.LEVEL_WEIGHT;
          score += m.reliability * this.RELIABILITY_WEIGHT;

          return { member: m, score };
        })
        // За рівного скору — стабільний порядок за userId
        .sort((a, b) => b.score - a.score || a.member.userId - b.member.userId);

      const picked = pool.slice(0, remaining);

      for (const { member } of picked) {
        assignments.push({ userId: member.userId, weekday: day.weekday });
        assignedHoursByUser.set(
          member.userId,
          (assignedHoursByUser.get(member.userId) ?? 0) + day.shiftHours,
        );
        if (wishSet.has(member.userId)) {
          warnings.push({
            weekday: day.weekday,
            type: 'WISH_VIOLATED',
            userId: member.userId,
            message: `Порушено побажання вихідного (день ${day.weekday}).`,
          });
        }
      }

      if (picked.length < remaining) {
        warnings.push({
          weekday: day.weekday,
          type: 'UNDERSTAFFED',
          message: `Недокомплект: потрібно ${day.required}, призначено ${
            day.coveredCount + picked.length
          } (день ${day.weekday}).`,
        });
      }
    }

    return { assignments, warnings };
  }

  /** Тривалість зміни в годинах з рядків "HH:mm". */
  private shiftLengthHours(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return minutes > 0 ? minutes / 60 : 0;
  }

  private isWeekend(weekday: number) {
    return weekday === 6 || weekday === 7;
  }

  async generateWeek(departmentId: number, dateISO: string) {
    const department = await this.prismaService.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      throw new BadRequestException('Відділення не знайдено.');
    }

    const staffing = (department.staffingByWeekday ?? {}) as Record<
      string,
      number
    >;
    const totalStaff = Object.values(staffing).reduce(
      (sum, n) => sum + (Number(n) || 0),
      0,
    );
    if (totalStaff <= 0) {
      throw new BadRequestException(
        'Спочатку задайте потрібний штат по днях у налаштуваннях відділення.',
      );
    }

    const members = await this.prismaService.user.findMany({
      where: { departments: { some: { id: departmentId } } },
      select: { id: true },
    });
    if (members.length === 0) {
      throw new BadRequestException(
        'У відділення немає жодного співробітника. Додайте членів команди.',
      );
    }

    const targetDate = new Date(dateISO);
    const { weekStart, weekEnd } = weekBounds(targetDate);
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Рівні членів (LVL + надійність) — вхід для скорингу
    const levels = await Promise.all(
      members.map((m) => this.employeeLevelService.getEmployeeLevel(m.id)),
    );
    const genMembers: GenMember[] = levels.map((l) => ({
      userId: l.userId,
      level: l.level,
      reliability: l.reliability,
    }));

    // Спершу прибираємо стару чернетку цього відділу — щоб не рахувати її як зайнятість
    await this.prismaService.workSchedule.deleteMany({
      where: {
        departmentId,
        isDraft: true,
        date: { gte: weekStart, lte: weekEnd },
      },
    });

    // Усе, що лишилось: published (будь-який відділ) + чернетки ІНШИХ відділів + побажання
    const [existingSchedules, wishes] = await Promise.all([
      this.prismaService.workSchedule.findMany({
        where: { date: { gte: weekStart, lte: weekEnd } },
        select: {
          userId: true,
          date: true,
          departmentId: true,
          isDraft: true,
          isDayOff: true,
        },
      }),
      this.prismaService.scheduleWish.findMany({
        where: {
          userId: { in: members.map((m) => m.id) },
          date: { gte: weekStart, lte: weekEnd },
        },
      }),
    ]);

    const memberIds = new Set(members.map((m) => m.id));
    const weekdayHours = (weekday: number) =>
      this.isWeekend(weekday)
        ? this.shiftLengthHours(
            department.weekendsOpeningTime,
            department.weekendsClosingTime,
          )
        : this.shiftLengthHours(
            department.weekdaysOpeningTime,
            department.weekdaysClosingTime,
          );

    const genDays: GenDay[] = weekDays.map((day) => {
      const weekday = getISODay(day); // 1..7
      const required = Number(staffing[String(weekday)] ?? 0);
      const sameDay = existingSchedules.filter(
        (s) => getISODay(s.date) === weekday,
      );

      // Зайняті будь-де цього дня (виключаємо з кандидатів)
      const busyUserIds = sameDay
        .filter((s) => memberIds.has(s.userId))
        .map((s) => s.userId);

      // Скільки слотів САМЕ цього відділу вже закрито (published цього відділу).
      // Вихідний слот НЕ закриває: людина того дня не працює. Без цієї умови
      // виставлений собі вихідний тихо зменшував потребу, і зміна виходила
      // недоукомплектованою навіть без попередження UNDERSTAFFED.
      const coveredCount = sameDay.filter(
        (s) => s.departmentId === departmentId && !s.isDraft && !s.isDayOff,
      ).length;

      const wishUserIds = wishes
        .filter((w) => getISODay(w.date) === weekday)
        .map((w) => w.userId);

      return {
        weekday,
        required,
        busyUserIds,
        coveredCount,
        wishUserIds,
        shiftHours: weekdayHours(weekday),
      };
    });

    const { assignments, warnings } = this.computeAssignments(
      genDays,
      genMembers,
    );

    const weekdayToDate = new Map(weekDays.map((d) => [getISODay(d), d]));

    const rows = assignments.map((a) => {
      const weekend = this.isWeekend(a.weekday);
      return {
        userId: a.userId,
        departmentId,
        date: weekdayToDate.get(a.weekday)!,
        startedAt: weekend
          ? department.weekendsOpeningTime
          : department.weekdaysOpeningTime,
        endTime: weekend
          ? department.weekendsClosingTime
          : department.weekdaysClosingTime,
        isDayOff: false,
        isDraft: true,
      };
    });

    let created = 0;
    if (rows.length > 0) {
      // skipDuplicates: якщо між читанням і записом хтось самостійно створив
      // рядок на той самий (userId, date) — не падаємо на unique, просто пропускаємо
      const result = await this.prismaService.workSchedule.createMany({
        data: rows,
        skipDuplicates: true,
      });
      created = result.count;
    }

    // Пропущені через гонку рядки — це реальний недокомплект, про який
    // computeAssignments знати не міг: він рахував попередження ДО вставки.
    const skipped = rows.length - created;
    if (skipped > 0) {
      warnings.push({
        weekday: 0,
        type: 'UNDERSTAFFED',
        message:
          `Не додано ${skipped} признач${skipped === 1 ? 'ення' : 'ень'}: ` +
          'графік на ці дні змінили під час генерації. Перевірте покриття.',
      });
    }

    this.eventsGateway.server.emit('invalidate_schedules');

    return {
      created,
      warnings,
    };
  }

  async publishWeek(departmentId: number, dateISO: string) {
    const { weekStart, weekEnd } = weekBounds(new Date(dateISO));

    const draftFilter = {
      departmentId,
      isDraft: true,
      date: { gte: weekStart, lte: weekEnd },
    };

    // Кого саме публікуємо — треба знати ДО updateMany, бо після нього
    // чернеток уже не існує і адресатів не відновити.
    const drafts = await this.prismaService.workSchedule.findMany({
      where: draftFilter,
      select: { userId: true },
      distinct: ['userId'],
    });

    const result = await this.prismaService.workSchedule.updateMany({
      where: draftFilter,
      data: { isDraft: false },
    });

    // Раніше публікація лише слала WS-подію: хто був офлайн, не дізнавався,
    // що графік вийшов.
    const weekLabel = formatISO(weekStart, { representation: 'date' });
    for (const { userId } of drafts) {
      await this.notificationsService.createNotification(userId, {
        title: 'Графік опубліковано',
        message: `Опубліковано графік на тиждень з ${weekLabel}. Перевірте свої зміни.`,
        category: 'schedule',
      });
    }

    this.eventsGateway.server.emit('invalidate_schedules');
    return { published: result.count };
  }

  async rejectWeek(departmentId: number, dateISO: string) {
    const { weekStart, weekEnd } = weekBounds(new Date(dateISO));
    const result = await this.prismaService.workSchedule.deleteMany({
      where: {
        departmentId,
        isDraft: true,
        date: { gte: weekStart, lte: weekEnd },
      },
    });
    this.eventsGateway.server.emit('invalidate_schedules');
    return { discarded: result.count };
  }
}
