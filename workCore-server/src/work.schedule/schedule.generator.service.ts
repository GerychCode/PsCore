import { BadRequestException, Injectable } from '@nestjs/common';
import { eachDayOfInterval, formatISO, getISODay, startOfDay } from 'date-fns';
import { weekBounds } from '../common/utils/week.util';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeLevelService } from '../employee.level/employee.level.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { AbsenceService } from '../absence/absence.service';

const MAX_LEVEL = 10;

export interface GenMember {
  userId: number;
  level: number;
  reliability: number;
  /**
   * Години, вже заплановані цього тижня будь-де (включно з іншими
   * відділеннями). Без них тижневий ліміт рахувався б лише по цьому запуску,
   * і людина, яка сама набрала змін, отримувала б ще стільки ж зверху.
   */
  plannedHours?: number;
  /** ISO-дні, на які в людини вже є рядок — база для «днів поспіль». */
  plannedWeekdays?: number[];
}

/**
 * Тверді обмеження навантаження. Значення 0 вимикає конкретне обмеження.
 * Дефолти орієнтовані на 40-годинний тиждень з одним вихідним і
 * міжзмінним відпочинком — генератор не має пропонувати те, за що
 * потім прилетить від інспекції праці.
 */
export interface LoadLimits {
  maxHoursPerWeek: number;
  maxConsecutiveDays: number;
  minRestHours: number;
}

export const DEFAULT_LOAD_LIMITS: LoadLimits = {
  maxHoursPerWeek: 40,
  maxConsecutiveDays: 6,
  minRestHours: 11,
};

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
  /**
   * Люди, що поставили собі вихідний у таблиці. Мʼяке обмеження: зайняти
   * можна, але дорого — лише коли інакше день не закрити.
   */
  dayOffUserIds?: number[];
  /**
   * Люди зі зміною в ІНШОМУ відділенні, яких дозволено перевести сюди.
   * Список уже відфільтрований: відділення-донор лишається укомплектованим.
   */
  borrowableUserIds?: number[];
  /** Тривалість зміни цього дня в годинах (для рівномірності навантаження) */
  shiftHours: number;
  /** Початок/кінець зміни в годинах (9.5 = 09:30) — для міжзмінного відпочинку */
  startHour?: number;
  endHour?: number;
}

/** Звідки взявся слот: новий рядок, зайнятий вихідний чи переведення. */
export type AssignmentSource = 'NEW' | 'DAY_OFF' | 'BORROW';

export interface Assignment {
  userId: number;
  weekday: number;
  source: AssignmentSource;
}

export interface GenWarning {
  weekday: number;
  type:
    | 'UNDERSTAFFED'
    | 'WISH_VIOLATED'
    | 'LIMIT_BLOCKED'
    | 'DAY_OFF_TAKEN'
    | 'BORROWED';
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
  /**
   * Штрафи-«крайні заходи», навмисно на порядки більші за WISH_PENALTY,
   * щоб спрацьовували лише за відсутності звичайних кандидатів. Порядок:
   * побажання → власний вихідний → переведення з іншого відділення.
   * Переведення найдорожче, бо зачіпає дві команди, а не одну людину.
   */
  private readonly DAY_OFF_PENALTY = 100_000;
  private readonly BORROW_PENALTY = 1_000_000;
  // Рівномірність за годинами: ~10-годинна зміна ≈ повний розкид рівнів
  private readonly FAIRNESS_PER_HOUR = 10;
  private readonly LEVEL_WEIGHT = 10;
  private readonly RELIABILITY_WEIGHT = 0.5;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly employeeLevelService: EmployeeLevelService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly absenceService: AbsenceService,
  ) {}

  /**
   * Чисте ядро: розподіляє членів по днях тижня за жадібним скорингом.
   * Не торкається БД — легко тестується.
   */
  /**
   * Чи не порушить призначення на цей день твердих обмежень навантаження.
   * Повертає причину відмови або null, якщо все гаразд.
   */
  private limitViolation(
    day: GenDay,
    state: { hours: number; days: Set<number> },
    limits: LoadLimits,
    dayByWeekday: Map<number, GenDay>,
  ): string | null {
    if (
      limits.maxHoursPerWeek > 0 &&
      state.hours + day.shiftHours > limits.maxHoursPerWeek
    ) {
      return 'тижневий ліміт годин';
    }

    if (limits.maxConsecutiveDays > 0) {
      // Довжина безперервної серії, у яку потрапить цей день.
      let run = 1;
      for (let d = day.weekday - 1; d >= 1 && state.days.has(d); d--) run++;
      for (let d = day.weekday + 1; d <= 7 && state.days.has(d); d++) run++;
      if (run > limits.maxConsecutiveDays) {
        return 'днів поспіль';
      }
    }

    if (limits.minRestHours > 0) {
      // Відпочинок між сусідніми днями: від кінця однієї зміни до початку
      // наступної. Часи беруться з цього відділення — для змін в іншому
      // відділенні це наближення, точні часи сюди не доходять.
      const prev = dayByWeekday.get(day.weekday - 1);
      const next = dayByWeekday.get(day.weekday + 1);
      const start = day.startHour ?? 0;
      const end = day.endHour ?? day.shiftHours;

      if (state.days.has(day.weekday - 1) && prev) {
        const rest = 24 - (prev.endHour ?? prev.shiftHours) + start;
        if (rest < limits.minRestHours) return 'відпочинок після попередньої зміни';
      }
      if (state.days.has(day.weekday + 1) && next) {
        const rest = 24 - end + (next.startHour ?? 0);
        if (rest < limits.minRestHours) return 'відпочинок перед наступною зміною';
      }
    }

    return null;
  }

  computeAssignments(
    days: GenDay[],
    members: GenMember[],
    limits: LoadLimits = DEFAULT_LOAD_LIMITS,
  ): GenResult {
    const assignments: Assignment[] = [];
    const warnings: GenWarning[] = [];
    // Наростаючі відпрацьовані години на тижні — основа рівномірності
    const assignedHoursByUser = new Map<number, number>();

    // Стан навантаження: стартує з того, що вже заплановано цього тижня,
    // інакше ліміти рахувалися б лише в межах одного запуску генератора.
    const loadState = new Map<number, { hours: number; days: Set<number> }>();
    for (const m of members) {
      loadState.set(m.userId, {
        hours: m.plannedHours ?? 0,
        days: new Set(m.plannedWeekdays ?? []),
      });
    }
    const dayByWeekday = new Map(days.map((d) => [d.weekday, d]));

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
      const dayOffSet = new Set(day.dayOffUserIds ?? []);
      const borrowSet = new Set(day.borrowableUserIds ?? []);
      const isPeak = day.required > avgRequired;

      // Обмеження — тверді: кандидат, що їх порушує, не потрапляє в пул
      // взагалі. Це не питання пріоритету, як побажання вихідного.
      let blockedByLimits = 0;
      const eligible = members.filter((m) => {
        if (busy.has(m.userId)) return false;
        const state = loadState.get(m.userId)!;
        if (this.limitViolation(day, state, limits, dayByWeekday)) {
          blockedByLimits += 1;
          return false;
        }
        return true;
      });

      const pool = eligible
        .map((m) => {
          const assignedHours = assignedHoursByUser.get(m.userId) ?? 0;
          let score = 0;

          if (wishSet.has(m.userId)) score -= this.WISH_PENALTY;
          if (dayOffSet.has(m.userId)) score -= this.DAY_OFF_PENALTY;
          if (borrowSet.has(m.userId)) score -= this.BORROW_PENALTY;
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
        const source: AssignmentSource = borrowSet.has(member.userId)
          ? 'BORROW'
          : dayOffSet.has(member.userId)
            ? 'DAY_OFF'
            : 'NEW';

        assignments.push({
          userId: member.userId,
          weekday: day.weekday,
          source,
        });

        if (source === 'DAY_OFF') {
          warnings.push({
            weekday: day.weekday,
            type: 'DAY_OFF_TAKEN',
            userId: member.userId,
            message:
              `День ${day.weekday}: зайнято власний вихідний працівника — ` +
              'інакше день не закривався.',
          });
        } else if (source === 'BORROW') {
          warnings.push({
            weekday: day.weekday,
            type: 'BORROWED',
            userId: member.userId,
            message:
              `День ${day.weekday}: працівника переведено з іншого відділення. ` +
              'Попередьте його менеджера.',
          });
        }
        assignedHoursByUser.set(
          member.userId,
          (assignedHoursByUser.get(member.userId) ?? 0) + day.shiftHours,
        );
        const state = loadState.get(member.userId)!;
        state.hours += day.shiftHours;
        state.days.add(day.weekday);
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

        // Окремо повідомляємо, коли людей насправді вистачає, але їх не
        // пускають обмеження: це керований випадок (підняти ліміт, найняти,
        // перерозподілити), а не той самий «нема кого ставити».
        if (blockedByLimits > 0) {
          warnings.push({
            weekday: day.weekday,
            type: 'LIMIT_BLOCKED',
            message:
              `День ${day.weekday}: ${blockedByLimits} прац. не призначено ` +
              'через обмеження навантаження (години на тиждень / дні поспіль / відпочинок).',
          });
        }
      }
    }

    return { assignments, warnings };
  }

  /** Тривалість зміни в годинах з рядків "HH:mm". Порожні часи — 0 годин. */
  private shiftLengthHours(start?: string | null, end?: string | null): number {
    if (!start || !end) return 0;
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

    const limits: LoadLimits = {
      maxHoursPerWeek:
        department.maxHoursPerWeek ?? DEFAULT_LOAD_LIMITS.maxHoursPerWeek,
      maxConsecutiveDays:
        department.maxConsecutiveDays ?? DEFAULT_LOAD_LIMITS.maxConsecutiveDays,
      minRestHours:
        department.minRestHours ?? DEFAULT_LOAD_LIMITS.minRestHours,
    };

    // Спершу відкочуємо попередню пропозицію цього відділу, щоб рахувати
    // з чистого стану: перехоплені рядки повертаємо власникам, решту чернеток
    // просто видаляємо.
    await this.restoreTakeovers(departmentId, weekStart, weekEnd);
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
          // потрібні, щоб порахувати вже заплановані години для лімітів
          startedAt: true,
          endTime: true,
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

    // Погоджені відсутності на цей тиждень (відпустки, лікарняні тощо)
    const absentByUser = await this.absenceService.absentUserIds(
      weekStart,
      weekEnd,
    );

    // Штат інших відділень — щоб не забрати людину з того, де й так впритул
    const allDepartments = await this.prismaService.department.findMany({
      select: { id: true, staffingByWeekday: true },
    });
    const staffingByDepartment = new Map<number, Record<string, number>>(
      allDepartments.map((d) => [
        d.id,
        (d.staffingByWeekday ?? {}) as Record<string, number>,
      ]),
    );
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

      // Зайняті цього дня — усі, кого не можна взяти взагалі. Двох категорій
      // тут навмисно НЕМАЄ: вони перейдуть у дорогі, але допустимі варіанти.
      const busyUserIds: number[] = [];
      const dayOffUserIds: number[] = [];
      const borrowableUserIds: number[] = [];

      for (const s of sameDay) {
        if (!memberIds.has(s.userId)) continue;

        // Власний вихідний — мʼяка перешкода: людина того дня вільна
        if (s.isDayOff) {
          dayOffUserIds.push(s.userId);
          continue;
        }

        // Зміна в іншому відділенні: перевести можна лише якщо донор
        // лишиться укомплектованим. Інакше ми просто пересуваємо дірку.
        if (s.departmentId !== departmentId && !s.isDraft) {
          const donorStaffing = staffingByDepartment.get(s.departmentId);
          const donorRequiredRaw = donorStaffing?.[String(weekday)];

          // Якщо в донора штат не налаштований, довести, що він лишиться
          // укомплектованим, неможливо — тоді не чіпаємо. Інакше відділення
          // без налаштувань виглядало б як таке, що «нікого не потребує»,
          // і його людей можна було б забирати всіх до одного.
          if (donorRequiredRaw !== undefined) {
            const donorAssigned = sameDay.filter(
              (o) =>
                o.departmentId === s.departmentId && !o.isDraft && !o.isDayOff,
            ).length;

            if (donorAssigned - 1 >= Number(donorRequiredRaw)) {
              borrowableUserIds.push(s.userId);
              continue;
            }
          }
        }

        busyUserIds.push(s.userId);
      }

      // Погоджена відсутність — тверда заборона, не побажання: людини
      // просто немає. Додаємо до «зайнятих», щоб не потрапила в пул.
      const dayKey = formatISO(day, { representation: 'date' });
      for (const [userId, days] of absentByUser) {
        if (!memberIds.has(userId)) continue;
        if (days.some((d) => formatISO(d, { representation: 'date' }) === dayKey)) {
          busyUserIds.push(userId);
        }
      }

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

      const weekend = this.isWeekend(weekday);
      const toHours = (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        return h + m / 60;
      };

      return {
        weekday,
        required,
        busyUserIds,
        coveredCount,
        wishUserIds,
        dayOffUserIds,
        borrowableUserIds,
        shiftHours: weekdayHours(weekday),
        startHour: toHours(
          weekend
            ? department.weekendsOpeningTime
            : department.weekdaysOpeningTime,
        ),
        endHour: toHours(
          weekend
            ? department.weekendsClosingTime
            : department.weekdaysClosingTime,
        ),
      };
    });

    // Вже заплановані цього тижня години й дні — база для лімітів. Рахуємо
    // по ВСІХ відділеннях: ліміт стосується людини, а не відділення.
    const plannedByUser = new Map<number, { hours: number; days: number[] }>();
    for (const s of existingSchedules) {
      if (!memberIds.has(s.userId) || s.isDayOff) continue;
      const entry = plannedByUser.get(s.userId) ?? { hours: 0, days: [] };
      entry.hours += this.shiftLengthHours(s.startedAt, s.endTime);
      entry.days.push(getISODay(s.date));
      plannedByUser.set(s.userId, entry);
    }
    for (const m of genMembers) {
      const planned = plannedByUser.get(m.userId);
      m.plannedHours = planned?.hours ?? 0;
      m.plannedWeekdays = planned?.days ?? [];
    }

    const { assignments, warnings } = this.computeAssignments(
      genDays,
      genMembers,
      limits,
    );

    const weekdayToDate = new Map(weekDays.map((d) => [getISODay(d), d]));

    // Перехоплення міняють НАЯВНІ рядки: створити другий на той самий день
    // не дасть unique(userId, date), та й людина не працює у двох місцях.
    const takeovers = assignments.filter((a) => a.source !== 'NEW');
    for (const a of takeovers) {
      const date = weekdayToDate.get(a.weekday)!;
      const existing = existingSchedules.find(
        (s) => s.userId === a.userId && getISODay(s.date) === a.weekday,
      );
      if (!existing) continue;

      const weekend = this.isWeekend(a.weekday);
      await this.prismaService.workSchedule.updateMany({
        where: { userId: a.userId, date: startOfDay(date) },
        data: {
          departmentId,
          startedAt: weekend
            ? department.weekendsOpeningTime
            : department.weekdaysOpeningTime,
          endTime: weekend
            ? department.weekendsClosingTime
            : department.weekdaysClosingTime,
          isDayOff: false,
          isDraft: true,
          takeover: {
            departmentId: existing.departmentId,
            isDayOff: !!existing.isDayOff,
            startedAt: existing.startedAt,
            endTime: existing.endTime,
          },
        },
      });
    }

    const rows = assignments
      .filter((a) => a.source === 'NEW')
      .map((a) => {
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

    let created = takeovers.length;
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

  /**
   * Повертає перехоплені рядки власникам: відділення, часи й ознаку
   * вихідного — як було до генерації. Використовується і при повторній
   * генерації, і при відхиленні пропозиції.
   */
  private async restoreTakeovers(
    departmentId: number,
    weekStart: Date,
    weekEnd: Date,
  ): Promise<number> {
    const taken = await this.prismaService.workSchedule.findMany({
      where: {
        departmentId,
        isDraft: true,
        takeover: { not: Prisma.DbNull },
        date: { gte: weekStart, lte: weekEnd },
      },
    });

    let restored = 0;
    for (const row of taken) {
      const prev = row.takeover as unknown as {
        departmentId: number;
        isDayOff: boolean;
        startedAt: string;
        endTime: string;
      } | null;

      // Postgres розрізняє SQL NULL і JSON null, і фільтр `not: DbNull`
      // другий пропускає. Без цієї перевірки такий рядок дав би падіння.
      if (!prev || typeof prev.departmentId !== 'number') continue;
      restored += 1;

      await this.prismaService.workSchedule.update({
        where: { id: row.id },
        data: {
          departmentId: prev.departmentId,
          isDayOff: prev.isDayOff,
          startedAt: prev.startedAt,
          endTime: prev.endTime,
          isDraft: false,
          takeover: Prisma.DbNull,
        },
      });
    }

    return restored;
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

    // Публікація закріплює й перехоплення: знімок «як було» більше не
    // потрібен, інакше наступне «Відхилити» відкотило б уже чинний графік.
    const result = await this.prismaService.workSchedule.updateMany({
      where: draftFilter,
      data: { isDraft: false, takeover: Prisma.DbNull },
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

    // Спершу віддаємо перехоплені рядки власникам — інакше deleteMany
    // знищив би чужі зміни разом зі своїми чернетками.
    const restored = await this.restoreTakeovers(
      departmentId,
      weekStart,
      weekEnd,
    );

    const result = await this.prismaService.workSchedule.deleteMany({
      where: {
        departmentId,
        isDraft: true,
        date: { gte: weekStart, lte: weekEnd },
      },
    });
    this.eventsGateway.server.emit('invalidate_schedules');
    return { discarded: result.count, restored };
  }
}
