import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDepartmentDto } from './dto/create.department.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Department } from '../../generated/prisma';
import { UpdateDepartmentDto } from './dto/update.department.dto';

@Injectable()
export class DepartmentService {
  constructor(private readonly prismaService: PrismaService) {}

  getAllDepartments() {
    return this.prismaService.department.findMany();
  }

  async getDepartmentById(id: number) {
    const department = await this.prismaService.department.findUnique({
      where: { id },
    });
    if (!department) throw new NotFoundException(`Відділення не знайдено!`);
    return department;
  }

  private async checkNameUnique(name: string, excludeId?: number) {
    const where: any = { name };
    if (excludeId) {
      where.NOT = { id: excludeId };
    }

    const existDepartment = await this.prismaService.department.findFirst({
      where,
      select: { id: true },
    });

    if (existDepartment) {
      throw new BadRequestException(`Відділення з назвою "${name}" вже існує!`);
    }
  }

  private validateTimeRange(openingTime: string, closingTime: string) {
    if (openingTime >= closingTime) {
      throw new BadRequestException(
          'Час закриття не може бути раніше або таким же, як час відкриття.',
      );
    }
  }

  private validateStaffing(staffing?: Record<string, number>) {
    if (!staffing) return;
    for (const [weekday, count] of Object.entries(staffing)) {
      const day = Number(weekday);
      if (!Number.isInteger(day) || day < 1 || day > 7) {
        throw new BadRequestException(
            'Ключі штату мають бути днями тижня від 1 (Пн) до 7 (Нд).',
        );
      }
      if (!Number.isInteger(count) || count < 0 || count > 50) {
        throw new BadRequestException(
            'Штат на день має бути цілим числом від 0 до 50.',
        );
      }
    }
  }

  async createDepartment(departmentDto: CreateDepartmentDto) {
    await this.checkNameUnique(departmentDto.name);

    this.validateTimeRange(
        departmentDto.weekdaysOpeningTime,
        departmentDto.weekdaysClosingTime,
    );
    this.validateTimeRange(
        departmentDto.weekendsOpeningTime,
        departmentDto.weekendsClosingTime,
    );
    this.validateStaffing(departmentDto.staffingByWeekday);

    return this.prismaService.department.create({
      data: { ...departmentDto },
    });
  }

  async updateDepartment(
      id: number,
      updateDepartmentDto: UpdateDepartmentDto,
  ) {
    if (Object.keys(updateDepartmentDto).length === 0)
      throw new BadRequestException('Ви не оновили жодного поля!');

    const departmentData = await this.getDepartmentById(id);

    if (updateDepartmentDto.name) {
      await this.checkNameUnique(updateDepartmentDto.name, id);
    }

    this.validateStaffing(updateDepartmentDto.staffingByWeekday);

    const weekdaysOpeningTime =
        updateDepartmentDto.weekdaysOpeningTime ||
        departmentData.weekdaysOpeningTime;
    const weekdaysClosingTime =
        updateDepartmentDto.weekdaysClosingTime ||
        departmentData.weekdaysClosingTime;
    const weekendsOpeningTime =
        updateDepartmentDto.weekendsOpeningTime ||
        departmentData.weekendsOpeningTime;
    const weekendsClosingTime =
        updateDepartmentDto.weekendsClosingTime ||
        departmentData.weekendsClosingTime;

    this.validateTimeRange(weekdaysOpeningTime, weekdaysClosingTime);
    this.validateTimeRange(weekendsOpeningTime, weekendsClosingTime);

    const changedData = Object.entries(updateDepartmentDto).reduce(
        (acc, [key, value]) => {
          if (departmentData[key] !== value) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Partial<UpdateDepartmentDto>,
    );

    if (Object.keys(changedData).length === 0) {
      throw new BadRequestException('Нові дані ідентичні поточним!');
    }

    return this.prismaService.department.update({
      where: { id },
      data: changedData,
    });
  }

  async getMembers(departmentId: number) {
    await this.getDepartmentById(departmentId);
    return this.prismaService.user.findMany({
      where: { departments: { some: { id: departmentId } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
      },
    });
  }

  async setMembers(departmentId: number, userIds: number[]) {
    await this.getDepartmentById(departmentId);

    const uniqueIds = Array.from(new Set(userIds));
    if (uniqueIds.length > 0) {
      const existing = await this.prismaService.user.count({
        where: { id: { in: uniqueIds } },
      });
      if (existing !== uniqueIds.length) {
        throw new BadRequestException(
            'Серед переданих ID є неіснуючі користувачі.',
        );
      }
    }

    await this.prismaService.department.update({
      where: { id: departmentId },
      data: {
        members: { set: uniqueIds.map((id) => ({ id })) },
      },
    });

    return this.getMembers(departmentId);
  }

  async deleteDepartment(id: number) {
    await this.getDepartmentById(id);

    await this.prismaService.workSchedule.deleteMany({
      where: {
        departmentId: id,
      },
    });

    await this.prismaService.workShift.deleteMany({
      where: {
        departmentId: id,
      },
    });

    return this.prismaService.department.delete({
      where: { id: id },
    });
  }
}