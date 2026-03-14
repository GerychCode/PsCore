import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { $Enums, User } from '../../generated/prisma';
import Role = $Enums.Role;
import * as bcrypt from 'bcrypt';
import { UpdateUserDto, UpdateUserDtoAdmin } from './dto/update.user.dto';
import { UserDto } from './dto/user.dto';
import { plainToInstance } from 'class-transformer';
import { PasswordDto } from './dto/password.dto';
import { FileStorageService } from '../file.storage/file.starage.service';
import { Redis } from 'ioredis';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly fileStorageService: FileStorageService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  public async generateTelegramCode(userId: number): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redisClient.set(`telegram-code:${code}`, userId, 'EX', 300);
    return code;
  }

  public async findAllUsers() {
    return this.prismaService.user.findMany({
      select: {
        id: true,
        avatar: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        dateOfBirth: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  public async findById(id: number) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id,
      },
    });
    if (!user) {
      throw new NotFoundException(`Користувача не знайдено`);
    }

    return plainToInstance(UserDto, user);
  }
  public findByEmail(email: string) {
    return this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
  }

  public async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    dateOfBirth?: string;
    phone?: string;
    address?: string;
    role?: Role;
    avatar?: string;
  }) {
    const user = await this.prismaService.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        passwordHash: data.password ? await bcrypt.hash(data.password, 10) : '',
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        role: data.role,
        avatar: data.avatar,
      },
    });
    return plainToInstance(UserDto, user);
  }

  public async updateUser(
    updateUserDto: UpdateUserDto | UpdateUserDtoAdmin,
    id?: number | undefined,
    user?: User,
  ) {
    if (Object.keys(updateUserDto).length === 0)
      throw new BadRequestException('Ви не обновили жодної строки!');

    const userData = user ? user : await this.findById(id);
    if (!user) {
      throw new NotFoundException(`Користувача не знайдено`);
    }

    const changedData = Object.keys(updateUserDto).reduce((acc, key) => {
      if (userData[key] !== updateUserDto[key]) {
        acc[key] = updateUserDto[key];
      }
      return acc;
    }, {});

    if (Object.keys(changedData).length === 0) {
      throw new BadRequestException('Нові дані ідентичні поточним!');
    }

    const updatedUser = await this.prismaService.user.update({
      where: { id: userData.id },
      data: {
        ...updateUserDto,
      },
    });

    return plainToInstance(UserDto, updatedUser);
  }

  public async destroyUser(userId: number, targetUserId: number) {
    if (userId === targetUserId) {
      throw new BadRequestException('Ви не можете видалити себе!');
    }
    const user = await this.prismaService.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) throw new NotFoundException(`Користувача не знайдено`);

    await this.prismaService.user.delete({
      where: { id: targetUserId },
    });
    return HttpStatus.OK;
  }

  public async destroySelf(userId: number, passwordDto: PasswordDto) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException(`Користувача не знайдено`);
    const validPassword = bcrypt.compareSync(
      passwordDto.password,
      user.passwordHash,
    );
    if (!validPassword) throw new BadRequestException('Невірний пароль!');

    await this.prismaService.user.delete({
      where: { id: userId },
    });
    return HttpStatus.OK;
  }

  async saveAvatarToDB(user: User, file: Express.Multer.File) {
    let oldImagePath: string = user?.avatar;
    const updatedUser = await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        avatar: file.filename,
      },
    });
    if (oldImagePath != '' && oldImagePath) {
      this.fileStorageService.deleteFile(oldImagePath);
    }
    return updatedUser;
  }

  async getAdmins() {
    const admins = await this.prismaService.user.findMany({
      where: { role: Role.Admin },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }
  public async getUserStatistics(userId: number, month: number, year: number) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const shifts = await this.prismaService.workShift.findMany({
      where: {
        userId: userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        tags: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    const totalShifts = shifts.length;
    const totalHours = shifts.reduce(
      (acc, shift) => acc + (shift.totalHours || 0),
      0,
    );
    const overtimeHours = totalHours > 176 ? totalHours - 176 : 0; //Змінити

    // 1. Дані для графіка годин по днях
    const dailyHoursMap = new Map<number, number>();
    shifts.forEach((shift) => {
      const day = shift.date.getDate();
      const currentHours = dailyHoursMap.get(day) || 0;
      dailyHoursMap.set(day, currentHours + (shift.totalHours || 0));
    });

    const dailyHours = Array.from(dailyHoursMap.entries()).map(
      ([day, hours]) => ({
        date: `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}`,
        hours: Number(hours.toFixed(2)),
      }),
    );

    const tagDistributionMap = new Map<string, number>();
    shifts.forEach((shift) => {
      const tagName =
        shift.tags && shift.tags.length > 0 ? shift.tags[0].name : 'Без тегу';
      const currentVal = tagDistributionMap.get(tagName) || 0;
      tagDistributionMap.set(tagName, currentVal + (shift.totalHours || 0));
    });

    const tagDistribution = Array.from(tagDistributionMap.entries()).map(
      ([name, value]) => ({
        name,
        value: Number(value.toFixed(2)),
      }),
    );

    return {
      totalHours: Number(totalHours.toFixed(2)),
      totalShifts,
      overtimeHours: Number(overtimeHours.toFixed(2)),
      dailyHours,
      tagDistribution,
    };
  }
}
