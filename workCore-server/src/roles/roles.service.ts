import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { ALL_PERMISSIONS, Permission } from '../common/permissions/permission.enum';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger('RolesService');

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Системні ролі гарантовано існують
    await this.ensureSystemRole({
      name: 'Адміністратор',
      color: '#ED4245',
      permissions: [Permission.ADMINISTRATOR],
      position: 100,
      isSystem: true,
      isDefault: false,
    });
    await this.ensureSystemRole({
      name: 'Співробітник',
      color: '#99AAB5',
      permissions: [],
      position: 0,
      isSystem: true,
      isDefault: true,
    });
  }

  private async ensureSystemRole(data: {
    name: string;
    color: string;
    permissions: Permission[];
    position: number;
    isSystem: boolean;
    isDefault: boolean;
  }) {
    const existing = await this.prisma.appRole.findUnique({
      where: { name: data.name },
    });
    if (!existing) {
      await this.prisma.appRole.create({ data });
      this.logger.log(`Створено системну роль "${data.name}"`);
    }
  }

  listPermissions() {
    return ALL_PERMISSIONS;
  }

  getAll() {
    return this.prisma.appRole.findMany({
      orderBy: { position: 'desc' },
      include: { _count: { select: { members: true } } },
    });
  }

  async getById(id: number) {
    const role = await this.prisma.appRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Роль не знайдено.');
    return role;
  }

  private async ensureNameFree(name: string, excludeId?: number) {
    const existing = await this.prisma.appRole.findFirst({
      where: { name, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(`Роль "${name}" вже існує.`);
    }
  }

  async create(dto: CreateRoleDto) {
    await this.ensureNameFree(dto.name);
    if (dto.isDefault) await this.clearDefault();
    return this.prisma.appRole.create({
      data: {
        name: dto.name,
        color: dto.color ?? '#99AAB5',
        permissions: dto.permissions ?? [],
        position: dto.position ?? 0,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.getById(id);

    if (dto.name && dto.name !== role.name) {
      await this.ensureNameFree(dto.name, id);
    }
    // Системним ролям не можна прибирати ADMINISTRATOR/дефолтність довільно —
    // але даємо міняти колір/назву/позицію. Права системних міняти забороняємо.
    if (role.isSystem && dto.permissions) {
      throw new BadRequestException(
        'Права системної ролі змінювати не можна.',
      );
    }
    if (dto.isDefault) await this.clearDefault();

    return this.prisma.appRole.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async remove(id: number) {
    const role = await this.getById(id);
    if (role.isSystem) {
      throw new BadRequestException('Системну роль видалити не можна.');
    }
    await this.prisma.appRole.delete({ where: { id } });
    return { success: true };
  }

  private clearDefault() {
    return this.prisma.appRole.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  async getUserRoles(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { appRoles: { orderBy: { position: 'desc' } } },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено.');
    return user.appRoles;
  }

  async setUserRoles(userId: number, roleIds: number[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Користувача не знайдено.');

    if (roleIds.length > 0) {
      const count = await this.prisma.appRole.count({
        where: { id: { in: roleIds } },
      });
      if (count !== roleIds.length) {
        throw new BadRequestException('Серед ролей є неіснуючі.');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { appRoles: { set: roleIds.map((id) => ({ id })) } },
    });
    return this.getUserRoles(userId);
  }

  /** Призначає дефолтну роль (викликається при реєстрації). */
  async assignDefaultRole(userId: number) {
    const def = await this.prisma.appRole.findFirst({
      where: { isDefault: true },
    });
    if (!def) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { appRoles: { connect: { id: def.id } } },
    });
  }
}
