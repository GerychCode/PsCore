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