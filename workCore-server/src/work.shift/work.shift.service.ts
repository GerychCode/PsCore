import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkShiftDto } from './dto/create.work.shift.dto';
import { endOfDay, parse, parseISO, startOfDay } from 'date-fns';
import { DepartmentService } from '../department/department.service';
import { $Enums, WorkShift, Role, User } from '../../generated/prisma';
import ShiftStatus = $Enums.ShiftStatus;
import { UpdateWorkShiftDto } from './dto/update.work.shift.dto.ts';
import { FilterShiftDto } from './dto/shift.filter.dto';

@Injectable()
export class WorkShiftService {
  constructor(
    private prismaService: PrismaService,
    private departmentService: DepartmentService,
  ) {}

  async getWorkShifts(user: User, shiftFilterDto: FilterShiftDto) {
    const userIdFilter =
      user.role === Role.Admin ? shiftFilterDto.userId : user.id;

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

  async getWorkShiftById(id: number) {
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
    return shift;
  }

  private async getSystemTag(name: string, severity: number) {
    let tag = await this.prismaService.tag.findUnique({ where: { name } });
    if (!tag) {
      tag = await this.prismaService.tag.create({
        data: { name, severity },
      });
    }
    return tag;
  }

  async createWorkShift(user: User, createWorkShiftDto: CreateWorkShiftDto) {
    let targetUserId = user.id;
    if (user.role === Role.Admin && createWorkShiftDto.userId) {
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

    this.validateWorkShift(dayShifts, startedAt, endAt, department.id);

    const tagsToConnect = [];

    const schedule = await this.prismaService.workSchedule.findFirst({
      where: {
        userId: targetUserId,
        date: {
          gte: startOfDay(shiftDate),
          lte: endOfDay(shiftDate),
        },
      },
    });

    if (!schedule) {
      const tag = await this.getSystemTag('Поза графіком', 2);
      tagsToConnect.push({ id: tag.id });
    } else {
      if (schedule.isDayOff) {
        const tag = await this.getSystemTag('У вихідний', 2);
        tagsToConnect.push({ id: tag.id });
      } else {
        if (createWorkShiftDto.startedAt > schedule.startedAt) {
          const tag = await this.getSystemTag('Запізнення', 2);
          tagsToConnect.push({ id: tag.id });
        }
      }
    }

    const status =
      user.role === Role.Admin ? ShiftStatus.APPROVED : ShiftStatus.PENDING;

    return this.prismaService.workShift.create({
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
  }

  async updateWorkShiftDto(
    id: number,
    updateWorkShiftDto: UpdateWorkShiftDto,
    user: User,
  ) {
    const existShift = await this.getWorkShiftById(id);

    if (user.role !== Role.Admin && existShift.userId !== user.id) {
      throw new ForbiddenException('Ви не можете редагувати чужі зміни!');
    }

    if (user.role !== Role.Admin) {
      delete updateWorkShiftDto.status;
      delete updateWorkShiftDto.tagIds;
    }

    const { tagIds, ...restDto } = updateWorkShiftDto;

    const changedData = Object.keys(restDto).reduce((acc, key) => {
      // @ts-ignore
      if (existShift[key] !== restDto[key]) {
        // @ts-ignore
        acc[key] = restDto[key];
      }
      return acc;
    }, {});

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
    const departmentId =
      updateWorkShiftDto.departmentId ?? existShift.departmentId;

    const startedAt = parse(startedAtStr, 'HH:mm', shiftDate);
    const endAt = parse(endTimeStr, 'HH:mm', shiftDate);

    if (endAt < startedAt) {
      throw new BadRequestException(
        'Ви не можете закінчити робочий день до його початку!',
      );
    }

    this.validateWorkShift(dayShifts, startedAt, endAt, departmentId, id);

    return this.prismaService.workShift.update({
      where: { id },
      data: {
        ...restDto,
        totalHours: (endAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60),
        ...(tagIds && {
          tags: {
            set: tagIds.map((tagId) => ({ id: tagId })),
          },
        }),
      },
      include: { tags: true },
    });
  }

  private validateWorkShift(
    dayShifts: WorkShift[],
    startedAt: Date,
    endAt: Date,
    departmentId: number,
    shiftId?: number,
  ) {
    dayShifts.forEach((day) => {
      const dayDate = day.date;
      const [startHour, startMinute] = day.startedAt.split(':').map(Number);
      const [endHour, endMinute] = day.endTime.split(':').map(Number);

      const existingStart = new Date(dayDate);
      existingStart.setHours(startHour, startMinute, 0, 0);

      const existingEnd = new Date(dayDate);
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

  async deleteShift(user: User, id: number) {
    const existEntry = await this.getWorkShiftById(id);

    if (user.role !== Role.Admin && user.id !== existEntry.userId) {
      throw new ForbiddenException('Ви не можете видаляти чужі зміни!');
    }

    return this.prismaService.workShift.delete({
      where: {
        id: id,
      },
    });
  }


}
