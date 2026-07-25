import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkShiftDto } from './dto/create.work.shift.dto';
import { endOfDay, getISODay, parse, parseISO, startOfDay } from 'date-fns';
import { DepartmentService } from '../department/department.service';
import { $Enums, User } from '../../generated/prisma';
import ShiftStatus = $Enums.ShiftStatus;
import NotificationType = $Enums.NotificationType;
import { UpdateWorkShiftDto } from './dto/update.work.shift.dto.ts';
import { FilterShiftDto } from './dto/shift.filter.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ShiftSessionService } from './shift.session.service';
import { hasPermission } from '../common/permissions/permissions.util';
import { Permission } from '../common/permissions/permission.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.actions';
import { TagRuleEngine } from '../work.shift.tag/tag-rule.engine';
import { pickChangedFields } from '../common/utils/pick-changed-fields';

/** Чи може користувач діяти над чужими змінами / бачити всі. */
const canManageAllShifts = (user: User) =>
  hasPermission(user as any, Permission.APPROVE_SHIFTS);

@Injectable()
export class WorkShiftService {
  constructor(
    private notificationsService: NotificationsService,
    private prismaService: PrismaService,
    private departmentService: DepartmentService,
    private readonly shiftSessionService: ShiftSessionService,
    private readonly audit: AuditService,
    private readonly tagRuleEngine: TagRuleEngine,
  ) {}

  async getWorkShifts(user: User, shiftFilterDto: FilterShiftDto) {
    const userIdFilter = canManageAllShifts(user)
      ? shiftFilterDto.userId
      : user.id;

    const where: any = {
      ...(shiftFilterDto.id && { id: shiftFilterDto.id }),
      ...(userIdFilter && { userId: userIdFilter }),
      ...(shiftFilterDto.departmentId && {
        departmentId: shiftFilterDto.departmentId,
      }),
      ...(shiftFilterDto.status && { status: shiftFilterDto.status }),
      ...(shiftFilterDto.dateFrom || shiftFilterDto.dateTo
        ? {
            date: {
              ...(shiftFilterDto.dateFrom && {
                gte: new Date(shiftFilterDto.dateFrom),
              }),
              ...(shiftFilterDto.dateTo && {
                lte: new Date(shiftFilterDto.dateTo),
              }),
            },
          }
        : {}),
      ...(shiftFilterDto.tagIds && shiftFilterDto.tagIds.length > 0
        ? {
            tags: {
              some: {
                id: { in: shiftFilterDto.tagIds },
              },
            },
          }
        : {}),
    };

    const shifts = await this.prismaService.workShift.findMany({
      where,
      include: {
        department: true,
        tags: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    return shifts;
  }

  /**
   * @param requester якщо передано — застосовуємо перевірку власності:
   * чужу зміну бачить лише той, хто має APPROVE_SHIFTS. Без requester
   * (внутрішні виклики) перевірку пропускаємо.
   */
  async getWorkShiftById(id: number, requester?: User) {
    const shift = await this.prismaService.workShift.findUnique({
      where: { id },
      include: {
        department: true,
        tags: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });
    if (!shift) throw new NotFoundException(`Зміну не знайдено!`);

    if (
      requester &&
      !canManageAllShifts(requester) &&
      shift.userId !== requester.id
    ) {
      throw new ForbiddenException('Немає доступу до цієї зміни.');
    }
    return shift;
  }

  async createWorkShift(user: User, createWorkShiftDto: CreateWorkShiftDto) {
    let targetUserId = user.id;
    if (canManageAllShifts(user) && createWorkShiftDto.userId) {
      targetUserId = createWorkShiftDto.userId;
    }

    const shiftDate = parseISO(createWorkShiftDto.date);
    const department = await this.departmentService.getDepartmentById(
      createWorkShiftDto.departmentId,
    );

    const dayShifts = await this.prismaService.workShift.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: startOfDay(shiftDate),
          lte: endOfDay(shiftDate),
        },
      },
    });

    const startedAt = parse(createWorkShiftDto.startedAt, 'HH:mm', shiftDate);
    const endAt = parse(createWorkShiftDto.endTime, 'HH:mm', shiftDate);

    if (endAt < startedAt)
      throw new BadRequestException(
        'Ви не можете закінчити робочий день до його початку!',
      );

    this.shiftSessionService.validateNoOverlap(dayShifts, startedAt, endAt);

    const schedule = await this.prismaService.workSchedule.findFirst({
      where: {
        userId: targetUserId,
        date: {
          gte: startOfDay(shiftDate),
          lte: endOfDay(shiftDate),
        },
      },
    });

    const tagsToConnect = await this.shiftSessionService.resolveScheduleTags(
      schedule,
      createWorkShiftDto.startedAt,
    );

    const status =
      canManageAllShifts(user) ? ShiftStatus.APPROVED : ShiftStatus.PENDING;

    const newShift = await this.prismaService.workShift.create({
      data: {
        date: shiftDate.toISOString(),
        startedAt: createWorkShiftDto.startedAt,
        endTime: createWorkShiftDto.endTime,
        totalHours: (endAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60),
        status: status,
        user: { connect: { id: targetUserId } },
        department: { connect: { id: department.id } },
        tags: {
          connect: tagsToConnect,
        },
      },
    });

    // Кастомні правила тегів (зміна створюється одразу завершеною)
    const late =
      !!schedule &&
      !schedule.isDayOff &&
      createWorkShiftDto.startedAt > schedule.startedAt;
    await this.tagRuleEngine.apply('SHIFT_ENDED', newShift.id, {
      userId: targetUserId,
      departmentId: department.id,
      totalHours: newShift.totalHours,
      startHour: parseInt(createWorkShiftDto.startedAt.split(':')[0], 10),
      endHour: parseInt(createWorkShiftDto.endTime.split(':')[0], 10),
      weekday: getISODay(shiftDate),
      late,
      offSchedule: !schedule,
      isDayOff: !!schedule?.isDayOff,
      status: newShift.status,
    });

    await this.shiftSessionService.notifyShiftChanged(targetUserId);

    return newShift;
  }

  async updateWorkShiftDto(
    id: number,
    updateWorkShiftDto: UpdateWorkShiftDto,
    user: User,
  ) {
    const existShift = await this.getWorkShiftById(id);

    if (!canManageAllShifts(user) && existShift.userId !== user.id) {
      throw new ForbiddenException('Ви не можете редагувати чужі зміни!');
    }

    if (existShift.status === ShiftStatus.APPROVED) {
      throw new ForbiddenException(
        'Заборонено редагувати підтверджений запис. Зверніться до адміністратора.',
      );
    }

    if (!canManageAllShifts(user)) {
      delete updateWorkShiftDto.status;
    }

    let dataToUpdate = {
      ...updateWorkShiftDto,
    };

    if (existShift.status === ShiftStatus.REJECTED) {
      dataToUpdate = {
        ...updateWorkShiftDto,
        status: ShiftStatus.PENDING,
      };
    }

    const { tagIds, ...restDto } = dataToUpdate;

    const changedData = pickChangedFields(existShift as any, restDto);

    if (
      Object.keys(changedData).length === 0 &&
      (!tagIds || tagIds.length === 0)
    ) {
      throw new BadRequestException('Нові дані ідентичні поточним!');
    }

    if (updateWorkShiftDto.departmentId)
      await this.departmentService.getDepartmentById(
        updateWorkShiftDto.departmentId,
      );

    const shiftDate = existShift.date;
    const targetUserId = existShift.userId;

    const dayShifts = await this.prismaService.workShift.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: startOfDay(shiftDate),
          lte: endOfDay(shiftDate),
        },
      },
    });

    const startedAtStr = updateWorkShiftDto.startedAt ?? existShift.startedAt;
    const endTimeStr = updateWorkShiftDto.endTime ?? existShift.endTime;

    // Активна (незавершена) зміна не має endTime — не перераховуємо години
    // й не валідуємо інтервал, щоб можна було, напр., підтвердити її статус.
    const isActiveShift = !endTimeStr;

    let totalHours = existShift.totalHours;
    if (!isActiveShift) {
      const startedAt = parse(startedAtStr, 'HH:mm', shiftDate);
      const endAt = parse(endTimeStr, 'HH:mm', shiftDate);

      if (endAt < startedAt) {
        throw new BadRequestException(
          'Ви не можете закінчити робочий день до його початку!',
        );
      }

      this.shiftSessionService.validateNoOverlap(
        dayShifts,
        startedAt,
        endAt,
        id,
      );

      totalHours = (endAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
    }

    const updatedShift = await this.prismaService.workShift.update({
      where: { id },
      data: {
        ...restDto,
        totalHours,
        ...(tagIds && {
          tags: {
            set: tagIds.map((tagId) => ({ id: tagId })),
          },
        }),
      },
      include: { tags: true },
    });

    const isOwner = user.id === existShift.userId;
    const statusChangedTo = changedData['status'];
    const formattedDate = new Date(shiftDate)
      .toLocaleDateString('uk-UA')
      .replace(/\./g, '-');

    let notify = false;
    let title = '';
    let message = '';

    if (statusChangedTo === ShiftStatus.APPROVED) {
      notify = true;
      title = 'Зміну підтверджено';
      message = `Вашу зміну за ${formattedDate} успішно підтверджено.`;
    } else if (statusChangedTo === ShiftStatus.REJECTED) {
      notify = true;
      title = 'Зміну відхилено';
      message = `Вашу зміну за ${formattedDate} відхилено адміністратором.`;
    } else if (!isOwner) {
      notify = true;
      title = 'Зміну оновлено';
      message = `Вашу зміну за ${formattedDate} було оновлено адміністратором.`;
    }

    if (notify && !isOwner) {
      await this.notificationsService.createNotification(existShift.userId, {
        title,
        message,
        type: NotificationType.INFO,
      });
    }

    if (statusChangedTo === ShiftStatus.APPROVED) {
      await this.audit.log({
        actorId: user.id,
        action: AuditAction.SHIFT_APPROVED,
        entity: 'WorkShift',
        entityId: id,
        metadata: { ownerId: existShift.userId },
      });
    } else if (statusChangedTo === ShiftStatus.REJECTED) {
      await this.audit.log({
        actorId: user.id,
        action: AuditAction.SHIFT_REJECTED,
        entity: 'WorkShift',
        entityId: id,
        metadata: { ownerId: existShift.userId },
      });
    }

    await this.shiftSessionService.notifyShiftChanged(existShift.userId);

    return updatedShift;
  }

  async deleteShift(user: User, id: number) {
    const existEntry = await this.getWorkShiftById(id);

    if (!canManageAllShifts(user) && user.id !== existEntry.userId) {
      throw new ForbiddenException('Ви не можете видаляти чужі зміни!');
    }

    if (
      existEntry.status === ShiftStatus.APPROVED &&
      !canManageAllShifts(user)
    ) {
      throw new ForbiddenException(
        'Заборонено редагувати підтверджений запис. Зверніться до адміністратора.',
      );
    }

    if (existEntry.user.id != user.id) {
      await this.notificationsService.createNotification(existEntry.user.id, {
        title: 'Зміну видалено',
        message: `Вашу зміну за ${new Date(existEntry.date).toLocaleDateString('uk-UA').replace(/\./g, '-')} видалено! \n Видалив: ${existEntry.user.firstName}`,
        type: NotificationType.INFO,
      });
    }

    const deletedShift = await this.prismaService.workShift.delete({
      where: {
        id: id,
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: AuditAction.SHIFT_DELETED,
      entity: 'WorkShift',
      entityId: id,
      metadata: { ownerId: existEntry.userId, date: existEntry.date },
    });

    await this.shiftSessionService.notifyShiftChanged(existEntry.userId);

    return deletedShift;
  }
}
