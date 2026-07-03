import { BadRequestException, Injectable } from '@nestjs/common';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  getISODay,
} from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeLevelService } from '../employee.level/employee.level.service';
import { EventsGateway } from '../events/events.gateway';

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
  /** Користувачі, які вже мають зміну цього дня (published, будь-яке відділення) */
  busyUserIds: number[];
  /** Користувачі, що хочуть цей день вихідним */
  wishUserIds: number[];
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
  // Рівномірність важливіша за рівень: одна зайва зміна ≈ повний розкид рівнів
  private readonly FAIRNESS_WEIGHT = 100;
  private readonly LEVEL_WEIGHT = 10;
  private readonly RELIABILITY_WEIGHT = 0.5;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly employeeLevelService: EmployeeLevelService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Чисте ядро: розподіляє членів по днях тижня за жадібним скорингом.
   * Не торкається БД — легко тестується.
   */
  computeAssignments(days: GenDay[], members: GenMember[]): GenResult {
    const assignments: Assignment[] = [];
    const warnings: GenWarning[] = [];
    const assignedCountByUser = new Map<number, number>();

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
      const alreadyCovered = day.busyUserIds.length;
      const remaining = day.required - alreadyCovered;
      if (remaining <= 0) continue;

      const wishSet = new Set(day.wishUserIds);
      const isPeak = day.required > avgRequired;

      const pool = members
        .filter((m) => !busy.has(m.userId))
        .map((m) => {
          const assigned = assignedCountByUser.get(m.userId) ?? 0;
          let score = 0;

          if (wishSet.has(m.userId)) score -= this.WISH_PENALTY;
          score -= assigned * this.FAIRNESS_WEIGHT;
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
        assignedCountByUser.set(
          member.userId,
          (assignedCountByUser.get(member.userId) ?? 0) + 1,
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
            alreadyCovered + picked.length
          } (день ${day.weekday}).`,
        });
      }
    }

    return { assignments, warnings };
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
    const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
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

    // Що вже зайнято (published-зміни будь-якого відділення) та побажання
    const [publishedSchedules, wishes] = await Promise.all([
      this.prismaService.workSchedule.findMany({
        where: {
          date: { gte: weekStart, lte: weekEnd },
          isDraft: false,
        },
        select: { userId: true, date: true, departmentId: true, isDayOff: true },
      }),
      this.prismaService.scheduleWish.findMany({
        where: {
          userId: { in: members.map((m) => m.id) },
          date: { gte: weekStart, lte: weekEnd },
        },
      }),
    ]);

    const memberIds = new Set(members.map((m) => m.id));

    const genDays: GenDay[] = weekDays.map((day) => {
      const weekday = getISODay(day); // 1..7
      const required = Number(staffing[String(weekday)] ?? 0);

      const busyUserIds = publishedSchedules
        .filter(
          (s) => getISODay(s.date) === weekday && memberIds.has(s.userId),
        )
        .map((s) => s.userId);

      const wishUserIds = wishes
        .filter((w) => getISODay(w.date) === weekday)
        .map((w) => w.userId);

      return { weekday, required, busyUserIds, wishUserIds };
    });

    const { assignments, warnings } = this.computeAssignments(
      genDays,
      genMembers,
    );

    // Пересоздаємо чернетку цього відділення на тиждень з нуля
    await this.prismaService.workSchedule.deleteMany({
      where: {
        departmentId,
        isDraft: true,
        date: { gte: weekStart, lte: weekEnd },
      },
    });

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

    if (rows.length > 0) {
      await this.prismaService.workSchedule.createMany({ data: rows });
    }

    this.eventsGateway.server.emit('invalidate_schedules');

    return {
      created: rows.length,
      warnings,
    };
  }

  async publishWeek(departmentId: number, dateISO: string) {
    const { weekStart, weekEnd } = this.weekBounds(dateISO);
    const result = await this.prismaService.workSchedule.updateMany({
      where: {
        departmentId,
        isDraft: true,
        date: { gte: weekStart, lte: weekEnd },
      },
      data: { isDraft: false },
    });
    this.eventsGateway.server.emit('invalidate_schedules');
    return { published: result.count };
  }

  async rejectWeek(departmentId: number, dateISO: string) {
    const { weekStart, weekEnd } = this.weekBounds(dateISO);
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

  private weekBounds(dateISO: string) {
    const targetDate = new Date(dateISO);
    return {
      weekStart: startOfWeek(targetDate, { weekStartsOn: 1 }),
      weekEnd: endOfWeek(targetDate, { weekStartsOn: 1 }),
    };
  }
}
