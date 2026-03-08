import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  formatISO,
  startOfDay,
  endOfDay,
  parse,
  parseISO,
} from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentService } from '../department/department.service';
import { UserService } from '../user/user.service';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { FilterWorkScheduleDto } from './dto/filter-work-schedule.dto';
import { LockWeekDto } from './dto/lock-week.dto';
import { Role, User } from '../../generated/prisma';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class WorkScheduleService {
  constructor(
    private prismaService: PrismaService,
    private departmentService: DepartmentService,
    private userService: UserService,
    private eventsGateway: EventsGateway,
  ) {}

  async getWorkSchedules(filterDto: FilterWorkScheduleDto) {
    return this.prismaService.workSchedule.findMany({
      where: {
        ...(filterDto.userId && { userId: filterDto.userId }),
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
    if (user.role !== Role.Admin && user.id !== createDto.userId) {
      throw new ForbiddenException(
        'Ви можете створювати графік тільки для себе.',
      );
    }

    const scheduleDate = parseISO(createDto.date);
    await this.checkWeekLock(createDto.departmentId, scheduleDate, user);

    await this.userService.findById(createDto.userId);
    await this.departmentService.getDepartmentById(createDto.departmentId);

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

    const newSchedule = await this.prismaService.workSchedule.create({
      data: {
        ...createDto,
        date: scheduleDate.toISOString(),
      },
    });

    this.eventsGateway.server.emit('invalidate_schedules');

    return newSchedule;
  }

  async updateWorkSchedule(
    user: User,
    id: number,
    updateDto: UpdateWorkScheduleDto,
  ) {
    const existingSchedule = await this.getWorkScheduleById(id);

    if (user.role !== Role.Admin && user.id !== existingSchedule.userId) {
      throw new ForbiddenException('Ви можете редагувати тільки свій графік.');
    }

    const scheduleDate = updateDto.date
      ? parseISO(updateDto.date)
      : existingSchedule.date;
    await this.checkWeekLock(existingSchedule.departmentId, scheduleDate, user);

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

    const updatedSchedule = await this.prismaService.workSchedule.update({
      where: { id },
      data: {
        ...updateDto,
        ...(updateDto.date && { date: scheduleDate.toISOString() }),
      },
    });

    this.eventsGateway.server.emit('invalidate_schedules');

    return updatedSchedule;
  }

  async deleteWorkSchedule(user: User, id: number) {
    const existingSchedule = await this.getWorkScheduleById(id);

    if (user.role !== Role.Admin && user.id !== existingSchedule.userId) {
      throw new ForbiddenException('Ви можете видаляти тільки свій графік.');
    }

    await this.checkWeekLock(
      existingSchedule.departmentId,
      existingSchedule.date,
      user,
    );

    const deletedSchedule = await this.prismaService.workSchedule.delete({
      where: { id },
    });

    this.eventsGateway.server.emit('invalidate_schedules');

    return deletedSchedule;
  }

  async getWeekView(date: string) {
    const targetDate = new Date(date);
    const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });

    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const [departments, users, schedules, locks] = await Promise.all([
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
        },
      }),
      this.prismaService.workScheduleLock.findMany({
        where: {
          weekStart: weekStart,
        },
      }),
    ]);

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

      return {
        departmentId: department.id,
        departmentName: department.name,
        isLocked: !!locksByDepartment[department.id],
        users: usersWithSchedulesInDept,
      };
    });

    return result;
  }

  async toggleWeekLock(dto: LockWeekDto) {
    const weekStart = startOfWeek(new Date(dto.date), { weekStartsOn: 1 });

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
    if (user.role === Role.Admin) return;

    const weekStart = startOfWeek(date, { weekStartsOn: 1 });

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
