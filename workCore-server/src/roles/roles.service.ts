import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { ALL_PERMISSIONS, Permission } from '../common/permissions/permission.enum';
import {
  maxRolePosition,
  resolvePermissions,
} from '../common/permissions/permissions.util';

/** Той, хто виконує дію (request.user з ролями). */
export interface Actor {
  id: number;
  role?: string | null;
  appRoles?: { permissions: string[]; position?: number }[] | null;
}

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger('RolesService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Перевіряє, що актор має право керувати роллю з такими правами й позицією:
   * - не можна чіпати роль із позицією ≥ вашої найвищої (крім повного адміна);
   * - не можна надати права, яких у вас немає (жодної ескалації).
   */
  private assertCanManageRole(
    actor: Actor,
    role: { permissions: string[]; position: number },
  ) {
    const actorPerms = resolvePermissions(actor);
    const actorMax = maxRolePosition(actor);

    if (role.position >= actorMax) {
      throw new ForbiddenException(
        'Не можна керувати роллю з позицією, вищою або рівною вашій.',
      );
    }
    const missing = (role.permissions ?? []).filter(
      (p) => !actorPerms.has(p),
    );
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Не можна надати права, яких ви не маєте: ${missing.join(', ')}`,
      );
    }
  }

  private assertDefaultSafe(isDefault: boolean, permissions: string[]) {
    if (isDefault && (permissions ?? []).includes(Permission.ADMINISTRATOR)) {
      throw new BadRequestException(
        'Роль із правом «Адміністратор» не може призначатися новим користувачам автоматично.',
      );
    }
  }

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

  async create(actor: Actor, dto: CreateRoleDto) {
    const permissions = dto.permissions ?? [];
    const position = dto.position ?? 0;
    // Не можна створити роль сильнішу/вищу за себе
    this.assertCanManageRole(actor, { permissions, position });
    this.assertDefaultSafe(dto.isDefault ?? false, permissions);

    await this.ensureNameFree(dto.name);
    if (dto.isDefault) await this.clearDefault();
    return this.prisma.appRole.create({
      data: {
        name: dto.name,
        color: dto.color ?? '#99AAB5',
        permissions,
        position,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(actor: Actor, id: number, dto: UpdateRoleDto) {
    const role = await this.getById(id);

    // Щоб редагувати роль, актор має бути здатний керувати нею у поточному стані
    this.assertCanManageRole(actor, {
      permissions: role.permissions,
      position: role.position,
    });

    if (dto.name && dto.name !== role.name) {
      await this.ensureNameFree(dto.name, id);
    }
    // Права системної ролі змінювати не можна взагалі
    if (role.isSystem && dto.permissions) {
      throw new BadRequestException(
        'Права системної ролі змінювати не можна.',
      );
    }

    const nextPermissions = dto.permissions ?? role.permissions;
    const nextPosition = dto.position ?? role.position;
    // Результуюча роль теж має лишатися в межах прав/позиції актора
    this.assertCanManageRole(actor, {
      permissions: nextPermissions,
      position: nextPosition,
    });
    this.assertDefaultSafe(dto.isDefault ?? role.isDefault, nextPermissions);

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

  async remove(actor: Actor, id: number) {
    const role = await this.getById(id);
    if (role.isSystem) {
      throw new BadRequestException('Системну роль видалити не можна.');
    }
    this.assertCanManageRole(actor, {
      permissions: role.permissions,
      position: role.position,
    });
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

  async setUserRoles(actor: Actor, userId: number, roleIds: number[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { appRoles: true },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено.');

    const uniqueIds = Array.from(new Set(roleIds));
    const targetRoles = uniqueIds.length
      ? await this.prisma.appRole.findMany({ where: { id: { in: uniqueIds } } })
      : [];
    if (targetRoles.length !== uniqueIds.length) {
      throw new BadRequestException('Серед ролей є неіснуючі.');
    }

    // Актор може лише ДОДАВАТИ/ЗНІМАТИ ролі, якими має право керувати.
    // Ролі поза його рівнем на цьому користувачі мають лишитися незмінними.
    const currentIds = new Set(user.appRoles.map((r) => r.id));
    const nextIds = new Set(uniqueIds);
    const changed = [
      ...targetRoles.filter((r) => !currentIds.has(r.id)), // додані
      ...user.appRoles.filter((r) => !nextIds.has(r.id)), // зняті
    ];
    for (const role of changed) {
      this.assertCanManageRole(actor, {
        permissions: role.permissions,
        position: role.position,
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { appRoles: { set: uniqueIds.map((id) => ({ id })) } },
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
