import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  eachDayOfInterval,
  formatISO,
  startOfDay,
  endOfDay,
  parse,
  parseISO,
  getISODay,
} from 'date-fns';
import { mondayWeekStart, weekBounds } from '../common/utils/week.util';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentService } from '../department/department.service';
import { UserService } from '../user/user.service';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { FilterWorkScheduleDto } from './dto/filter-work-schedule.dto';
import { LockWeekDto } from './dto/lock-week.dto';
import { Prisma, User } from '../../generated/prisma';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { hasPermission } from '../common/permissions/permissions.util';
import { Permission } from '../common/permissions/permission.enum';

/** Чи може користувач керувати чужими графіками / генерувати / обходити лок. */
const canManageSchedule = (user: User) =>
  hasPermission(user as any, Permission.MANAGE_SCHEDULE);

/** Порушення unique (userId, date) — гонка «два розклади на день». */
const isDuplicateDay = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class WorkScheduleService {
  constructor(
    private prismaService: PrismaService,
    private departmentService: DepartmentService,
    private userService: UserService,
    private eventsGateway: EventsGateway,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Без MANAGE_SCHEDULE користувач бачить лише власні опубліковані рядки:
   * чужий графік і чернетки до публікації — не його справа. Раніше цей
   * ендпоінт віддавав усе всім, обходячи приховування чернеток у week-view.
   */
  async getWorkSchedules(user: User, filterDto: FilterWorkScheduleDto) {
    const restricted = !canManageSchedule(user);

    return this.prismaService.workSchedule.findMany({
      where: {
        ...(restricted
          ? { userId: user.id, isDraft: false }
          : {
              ...(filterDto.userId && { userId: filterDto.userId }),
            }),
        ...(filterDto.departmentId && { departmentId: filterDto.departmentId }),
        ...(filterDto.dateFrom || filterDto.dateTo
          ? {
              date: {
                ...(filterDto.dateFrom && {
                  gte: new Date(filterDto.dateFrom),
                }),
                ...(filterDto.dateTo && {
                  lte: new Date(filterDto.dateTo),
                }),
              },
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        department: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async getWorkScheduleById(id: number) {
    const schedule = await this.prismaService.workSchedule.findUnique({
      where: { id },
    });
    if (!schedule) throw new NotFoundException('Розклад не знайдено!');
    return schedule;
  }

  async createWorkSchedule(user: User, createDto: CreateWorkScheduleDto) {
    if (!canManageSchedule(user) && user.id !== createDto.userId) {
      throw new ForbiddenException(
        'Ви можете створювати графік тільки для себе.',
      );
    }

    const scheduleDate = parseISO(createDto.date);
    await this.checkWeekLock(createDto.departmentId, scheduleDate, user);

    await this.userService.findById(createDto.userId);
    await this.departmentService.getDepartmentById(createDto.departmentId);

    // Без прав можна вписатись лише у власне відділення. Інакше людина
    // з'являлась у чужому графіку і, через busyUserIds, блокувала себе
    // для власного відділення; заразом це обходило замок чужого тижня.
    await this.assertMembership(user, createDto.userId, createDto.departmentId);

    const startedAt = parse(createDto.startedAt, 'HH:mm', scheduleDate);
    const endAt = parse(createDto.endTime, 'HH:mm', scheduleDate);

    if (endAt < startedAt) {
      throw new BadRequestException(
        'Час закінчення не може бути раніше часу початку!',
      );
    }

    const existingSchedule = await this.prismaService.workSchedule.findFirst({
      where: {
        userId: createDto.userId,
        date: {
          gte: startOfDay(scheduleDate),
          lte: endOfDay(scheduleDate),
        },
      },
    });

    if (existingSchedule) {
      throw new BadRequestException(
        'У цього користувача вже є розклад на цей день!',
      );
    }

    let newSchedule;
    try {
      newSchedule = await this.prismaService.workSchedule.create({
        data: {
          ...createDto,
          // Нормалізуємо до початку дня — узгоджено з unique(userId, date)
          date: startOfDay(scheduleDate),
        },
      });
    } catch (e) {
      // Гонка: між перевіркою existingSchedule і create вставили дубль
      if (isDuplicateDay(e)) {
        throw new BadRequestException(
          'У цього користувача вже є розклад на цей день!',
        );
      }
      throw e;
    }

    this.eventsGateway.server.emit('invalidate_schedules');

    return newSchedule;
  }

  async updateWorkSchedule(
    user: User,
    id: number,
    updateDto: UpdateWorkScheduleDto,
  ) {
    const existingSchedule = await this.getWorkScheduleById(id);

    if (!canManageSchedule(user) && user.id !== existingSchedule.userId) {
      throw new ForbiddenException('Ви можете редагувати тільки свій графік.');
    }

    // Власник рядка міг перепризначити його будь-кому, просто підмінивши
    // userId у тілі запиту — це обходило весь механізм обміну змінами
    // (ShiftSwap) з його підтвердженням менеджера.
    if (!canManageSchedule(user)) {
      if (
        updateDto.userId !== undefined &&
        updateDto.userId !== existingSchedule.userId
      ) {
        throw new ForbiddenException(
          'Передати зміну іншому працівнику можна лише через обмін.',
        );
      }
      if (
        updateDto.departmentId !== undefined &&
        updateDto.departmentId !== existingSchedule.departmentId
      ) {
        throw new ForbiddenException(
          'Змінювати відділення зміни може лише менеджер.',
        );
      }
    }

    const scheduleDate = updateDto.date
      ? parseISO(updateDto.date)
      : existingSchedule.date;

    // Замок перевіряємо і для тижня-джерела, і для тижня-призначення.
    // Раніше перевірявся лише другий, тож рядок можна було "винести"
    // із залоченого тижня, просто змінивши дату на вільний.
    await this.checkWeekLock(
      existingSchedule.departmentId,
      existingSchedule.date,
      user,
    );
    if (updateDto.date) {
      await this.checkWeekLock(
        existingSchedule.departmentId,
        scheduleDate,
        user,
      );
    }

    if (updateDto.departmentId) {
      await this.departmentService.getDepartmentById(updateDto.departmentId);
    }

    if (updateDto.userId || updateDto.date) {
      const targetUserId = updateDto.userId || existingSchedule.userId;

      const conflictSchedule = await this.prismaService.workSchedule.findFirst({
        where: {
          userId: targetUserId,
          date: {
            gte: startOfDay(scheduleDate),
            lte: endOfDay(scheduleDate),
          },
          id: { not: id },
        },
      });

      if (conflictSchedule) {
        throw new BadRequestException(
          'У цього користувача вже є розклад на цей день!',
        );
      }
    }

    const startedAtStr = updateDto.startedAt ?? existingSchedule.startedAt;
    const endTimeStr = updateDto.endTime ?? existingSchedule.endTime;

    const startedAt = parse(startedAtStr, 'HH:mm', scheduleDate);
    const endAt = parse(endTimeStr, 'HH:mm', scheduleDate);

    if (endAt < startedAt) {
      throw new BadRequestException(
        'Час закінчення не може бути раніше часу початку!',
      );
    }

    let updatedSchedule;
    try {
      updatedSchedule = await this.prismaService.workSchedule.update({
        where: { id },
        data: {
          ...updateDto,
          ...(updateDto.date && { date: startOfDay(scheduleDate) }),
        },
      });
    } catch (e) {
      if (isDuplicateDay(e)) {
        throw new BadRequestException(
          'У цього користувача вже є розклад на цей день!',
        );
      }
      throw e;
    }

    this.eventsGateway.server.emit('invalidate_schedules');

    return updatedSchedule;
  }

  async deleteWorkSchedule(user: User, id: number) {
    const existingSchedule = await this.getWorkScheduleById(id);

    if (!canManageSchedule(user) && user.id !== existingSchedule.userId) {
      throw new ForbiddenException('Ви можете видаляти тільки свій графік.');
    }

    await this.checkWeekLock(
      existingSchedule.departmentId,
      existingSchedule.date,
      user,
    );

    // ShiftSwap.scheduleId має onDelete: Cascade, тож активні пропозиції
    // зникнуть разом із рядком. Попереджаємо учасників ДО видалення —
    // інакше той, хто вже погодився взяти зміну, лишався б певен, що вона за ним.
    await this.notifyAffectedSwaps(existingSchedule.id, user.id);

    const deletedSchedule = await this.prismaService.workSchedule.delete({
      where: { id },
    });

    this.eventsGateway.server.emit('invalidate_schedules');
    this.eventsGateway.server.emit('invalidate_swaps');

    return deletedSchedule;
  }

  /** Сповіщає учасників активних обмінів, що зміну (а з нею й пропозицію) видалено. */
  private async notifyAffectedSwaps(scheduleId: number, actorId: number) {
    const swaps = await this.prismaService.shiftSwap.findMany({
      where: { scheduleId, status: { in: ['OPEN', 'CLAIMED'] } },
      select: { requesterId: true, claimerId: true },
    });

    const recipients = new Set<number>();
    for (const swap of swaps) {
      recipients.add(swap.requesterId);
      if (swap.claimerId) recipients.add(swap.claimerId);
    }
    recipients.delete(actorId);

    for (const userId of recipients) {
      await this.notificationsService.createNotification(userId, {
        title: 'Обмін скасовано',
        message:
          'Планову зміну видалено з графіка, тому пропозицію обміну закрито.',
        category: 'schedule',
      });
    }
  }

  /** Без MANAGE_SCHEDULE вписувати можна лише у відділення, де ти є в складі. */
  private async assertMembership(
    user: User,
    targetUserId: number,
    departmentId: number,
  ) {
    if (canManageSchedule(user)) return;

    const isMember = await this.prismaService.user.count({
      where: { id: targetUserId, departments: { some: { id: departmentId } } },
    });

    if (!isMember) {
      throw new ForbiddenException('Ви не входите у це відділення.');
    }
  }

  async getWeekView(date: string, isAdmin = false) {
    const targetDate = new Date(date);
    const { weekStart, weekEnd } = weekBounds(targetDate);

    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const [departments, users, schedules, locks, wishes] = await Promise.all([
      this.prismaService.department.findMany({ where: { isActive: true } }),
      this.prismaService.user.findMany({
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prismaService.workSchedule.findMany({
        where: {
          date: {
            gte: weekStart,
            lte: weekEnd,
          },
          // Чернетки бачить лише адмін до публікації
          ...(isAdmin ? {} : { isDraft: false }),
        },
      }),
      this.prismaService.workScheduleLock.findMany({
        where: {
          weekStart: weekStart,
        },
      }),
      // Побажання потрібні лише адміну — щоб позначити порушення в чернетці
      isAdmin
        ? this.prismaService.scheduleWish.findMany({
            where: { date: { gte: weekStart, lte: weekEnd } },
          })
        : Promise.resolve([]),
    ]);

    // Набір "userId|дата" для швидкої перевірки порушених побажань
    const wishKeys = new Set(
      wishes.map(
        (w) => `${w.userId}|${formatISO(w.date, { representation: 'date' })}`,
      ),
    );

    const schedulesByUser = schedules.reduce((acc, schedule) => {
      if (!acc[schedule.userId]) {
        acc[schedule.userId] = {};
      }
      const dayKey = formatISO(schedule.date, { representation: 'date' });
      acc[schedule.userId][dayKey] = schedule;
      return acc;
    }, {});

    const locksByDepartment = locks.reduce((acc, lock) => {
      acc[lock.departmentId] = lock.isLocked;
      return acc;
    }, {});

    const result = departments.map((department) => {
      const departmentUsers = users.map((user) => {
        const userScheduleForWeek = weekDays.map((day) => {
          const dayKey = formatISO(day, { representation: 'date' });
          const schedule = schedulesByUser[user.id]?.[dayKey];

          if (schedule && schedule.departmentId === department.id) {
            return {
              id: schedule.id,
              date: dayKey,
              startedAt: schedule.startedAt,
              endTime: schedule.endTime,
              isDayOff: schedule.isDayOff,
              isDraft: schedule.isDraft,
              // Чернетка, що ставить людину в її бажаний вихідний
              wishViolated:
                schedule.isDraft &&
                !schedule.isDayOff &&
                wishKeys.has(`${user.id}|${dayKey}`),
            };
          }
          return null;
        });

        return {
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          schedule: userScheduleForWeek,
        };
      });

      const usersWithSchedulesInDept = departmentUsers.filter((u) =>
        u.schedule.some((s) => s !== null),
      );

      // Скільки людей стоїть на кожен день тижня vs потрібний штат
      const staffing = (department.staffingByWeekday ?? {}) as Record<
        string,
        number
      >;
      const coverage = weekDays.map((day, index) => {
        const required = Number(staffing[String(getISODay(day))] ?? 0);
        const assigned = usersWithSchedulesInDept.filter((u) => {
          const cell = u.schedule[index];
          return cell && !cell.isDayOff;
        }).length;
        return { required, assigned };
      });

      return {
        departmentId: department.id,
        departmentName: department.name,
        isLocked: !!locksByDepartment[department.id],
        staffingByWeekday: department.staffingByWeekday ?? null,
        coverage,
        users: usersWithSchedulesInDept,
      };
    });

    return result;
  }

  async toggleWeekLock(dto: LockWeekDto) {
    const weekStart = mondayWeekStart(new Date(dto.date));

    const result = await this.prismaService.workScheduleLock.upsert({
      where: {
        departmentId_weekStart: {
          departmentId: dto.departmentId,
          weekStart: weekStart,
        },
      },
      update: {
        isLocked: dto.isLocked,
      },
      create: {
        departmentId: dto.departmentId,
        weekStart: weekStart,
        isLocked: dto.isLocked,
      },
    });

    this.eventsGateway.server.emit('invalidate_schedules');

    return result;
  }

  private async checkWeekLock(departmentId: number, date: Date, user: User) {
    if (canManageSchedule(user)) return;

    const weekStart = mondayWeekStart(date);

    const lock = await this.prismaService.workScheduleLock.findUnique({
      where: {
        departmentId_weekStart: {
          departmentId,
          weekStart,
        },
      },
    });

    if (lock && lock.isLocked) {
      throw new BadRequestException(
        'Графік на цей тиждень заблоковано адміністратором.',
      );
    }
  }
}
