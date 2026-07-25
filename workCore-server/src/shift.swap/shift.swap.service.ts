import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { endOfDay, startOfDay } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.actions';
import { CreateSwapDto } from './dto/create-swap.dto';
import { Prisma, User } from '../../generated/prisma';
import { hasPermission } from '../common/permissions/permissions.util';
import { Permission } from '../common/permissions/permission.enum';
import { fullName } from '../common/utils/full-name';

const ACTIVE = ['OPEN', 'CLAIMED'] as const;

const scheduleInclude = {
  schedule: {
    include: { department: { select: { id: true, name: true } } },
  },
  requester: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  claimer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  target: { select: { id: true, firstName: true, lastName: true, avatar: true } },
};

@Injectable()
export class ShiftSwapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  private async isDepartmentMember(userId: number, departmentId: number) {
    const count = await this.prisma.user.count({
      where: { id: userId, departments: { some: { id: departmentId } } },
    });
    return count > 0;
  }

  /** Виставити свою планову зміну на обмін. */
  async create(actor: User, dto: CreateSwapDto) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id: dto.scheduleId },
      include: { department: { select: { id: true, name: true } } },
    });
    if (!schedule) throw new NotFoundException('Зміну графіка не знайдено.');

    if (schedule.userId !== actor.id) {
      throw new ForbiddenException('Можна віддавати лише власну зміну.');
    }
    if (schedule.isDraft) {
      throw new BadRequestException('Неопубліковану зміну обміняти не можна.');
    }
    if (schedule.isDayOff) {
      throw new BadRequestException('Це вихідний, а не робоча зміна.');
    }
    if (schedule.date < startOfDay(new Date())) {
      throw new BadRequestException('Зміна вже в минулому.');
    }

    const existing = await this.prisma.shiftSwap.findFirst({
      where: { scheduleId: dto.scheduleId, status: { in: [...ACTIVE] } },
    });
    if (existing) {
      throw new BadRequestException('Для цієї зміни вже є активна пропозиція.');
    }

    if (dto.targetUserId) {
      if (dto.targetUserId === actor.id) {
        throw new BadRequestException('Не можна віддати зміну самому собі.');
      }
      const ok = await this.isDepartmentMember(
        dto.targetUserId,
        schedule.departmentId,
      );
      if (!ok) {
        throw new BadRequestException(
          'Отримувач не входить у відділення цієї зміни.',
        );
      }
    }

    const swap = await this.prisma.shiftSwap.create({
      data: {
        scheduleId: dto.scheduleId,
        requesterId: actor.id,
        targetUserId: dto.targetUserId ?? null,
        reason: dto.reason,
        status: 'OPEN',
      },
      include: scheduleInclude,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.SWAP_CREATED,
      entity: 'ShiftSwap',
      entityId: swap.id,
      metadata: {
        scheduleId: dto.scheduleId,
        targetUserId: dto.targetUserId ?? null,
      },
    });

    // Направлена пропозиція — одразу сповіщаємо адресата
    if (dto.targetUserId) {
      await this.notifications.createNotification(dto.targetUserId, {
        title: 'Вам пропонують взяти зміну',
        message: `${fullName(actor)} пропонує вам свою зміну у «${schedule.department.name}».`,
        category: 'schedule',
      });
    }

    this.events.emitToAll('invalidate_swaps');
    return swap;
  }

  private async loadSwap(id: number) {
    const swap = await this.prisma.shiftSwap.findUnique({
      where: { id },
      include: scheduleInclude,
    });
    if (!swap) throw new NotFoundException('Пропозицію не знайдено.');
    return swap;
  }

  /** Погодитись забрати запропоновану зміну. */
  async claim(actor: User, id: number) {
    const swap = await this.loadSwap(id);
    if (swap.status !== 'OPEN') {
      throw new BadRequestException('Пропозицію вже забрали або закрито.');
    }
    if (swap.requesterId === actor.id) {
      throw new BadRequestException('Не можна забрати власну зміну.');
    }
    if (swap.targetUserId && swap.targetUserId !== actor.id) {
      throw new ForbiddenException('Ця пропозиція адресована іншому працівнику.');
    }

    const ok = await this.isDepartmentMember(
      actor.id,
      swap.schedule.departmentId,
    );
    if (!ok) {
      throw new BadRequestException('Ви не входите у відділення цієї зміни.');
    }

    // Немає власної зміни того ж дня
    const clash = await this.prisma.workSchedule.findFirst({
      where: {
        userId: actor.id,
        id: { not: swap.scheduleId },
        date: {
          gte: startOfDay(swap.schedule.date),
          lte: endOfDay(swap.schedule.date),
        },
      },
    });
    if (clash) {
      throw new BadRequestException('У вас уже є зміна цього дня.');
    }

    const updated = await this.prisma.shiftSwap.update({
      where: { id },
      data: { claimerId: actor.id, status: 'CLAIMED' },
      include: scheduleInclude,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.SWAP_CLAIMED,
      entity: 'ShiftSwap',
      entityId: id,
      metadata: { scheduleId: swap.scheduleId },
    });

    await this.notifications.createNotification(swap.requesterId, {
      title: 'Вашу зміну готові забрати',
      message: `${fullName(actor)} погодився взяти вашу зміну. Очікує підтвердження менеджера.`,
      category: 'schedule',
    });

    this.events.emitToAll('invalidate_swaps');
    return updated;
  }

  /** Менеджер підтверджує обмін — зміна переходить до нового працівника. */
  async approve(actor: User, id: number) {
    const swap = await this.loadSwap(id);
    if (swap.status !== 'CLAIMED' || !swap.claimerId) {
      throw new BadRequestException('Немає охочого — підтверджувати нічого.');
    }

    const claimerId = swap.claimerId;

    // Між claim і approve у того, хто забирає, могла з'явитися власна зміна
    // на цей день (напр. адмін згенерував і опублікував тиждень). Перевіряємо
    // всередині транзакції, а unique(userId, date) ловимо як запобіжник —
    // раніше він вилітав неопрацьованим P2002 і клієнт отримував 500.
    try {
      await this.prisma.$transaction(async (tx) => {
        const clash = await tx.workSchedule.findFirst({
          where: {
            userId: claimerId,
            id: { not: swap.scheduleId },
            date: {
              gte: startOfDay(swap.schedule.date),
              lte: endOfDay(swap.schedule.date),
            },
          },
        });
        if (clash) {
          throw new BadRequestException(
            'У працівника вже з’явилася зміна на цей день — обмін неможливий.',
          );
        }

        await tx.workSchedule.update({
          where: { id: swap.scheduleId },
          data: { userId: claimerId },
        });
        await tx.shiftSwap.update({
          where: { id },
          data: { status: 'APPROVED', resolvedAt: new Date() },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'У працівника вже з’явилася зміна на цей день — обмін неможливий.',
        );
      }
      throw e;
    }

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.SWAP_APPROVED,
      entity: 'ShiftSwap',
      entityId: id,
      metadata: {
        scheduleId: swap.scheduleId,
        from: swap.requesterId,
        to: claimerId,
      },
    });

    const dept = swap.schedule.department.name;
    await this.notifications.createNotification(swap.requesterId, {
      title: 'Обмін підтверджено',
      message: `Вашу зміну у «${dept}» передано ${swap.claimer ? fullName(swap.claimer) : 'колезі'}.`,
      category: 'schedule',
    });
    await this.notifications.createNotification(claimerId, {
      title: 'Зміну закріплено за вами',
      message: `Менеджер підтвердив передачу зміни у «${dept}». Тепер вона ваша.`,
      category: 'schedule',
    });

    this.events.emitToAll('invalidate_swaps');
    this.events.emitToAll('invalidate_schedules');
    return this.loadSwap(id);
  }

  /** Менеджер відхиляє обмін. */
  async reject(actor: User, id: number) {
    const swap = await this.loadSwap(id);
    if (!ACTIVE.includes(swap.status as any)) {
      throw new BadRequestException('Пропозиція вже закрита.');
    }

    const updated = await this.prisma.shiftSwap.update({
      where: { id },
      data: { status: 'REJECTED', resolvedAt: new Date() },
      include: scheduleInclude,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.SWAP_REJECTED,
      entity: 'ShiftSwap',
      entityId: id,
    });

    await this.notifications.createNotification(swap.requesterId, {
      title: 'Обмін відхилено',
      message: 'Менеджер відхилив передачу вашої зміни — вона лишається за вами.',
      category: 'schedule',
    });
    if (swap.claimerId) {
      await this.notifications.createNotification(swap.claimerId, {
        title: 'Обмін відхилено',
        message: 'Менеджер відхилив передачу зміни, яку ви хотіли взяти.',
        category: 'schedule',
      });
    }

    this.events.emitToAll('invalidate_swaps');
    return updated;
  }

  /** Автор скасовує власну пропозицію. */
  async cancel(actor: User, id: number) {
    const swap = await this.loadSwap(id);
    if (swap.requesterId !== actor.id) {
      throw new ForbiddenException('Скасувати може лише автор пропозиції.');
    }
    if (!ACTIVE.includes(swap.status as any)) {
      throw new BadRequestException('Пропозиція вже закрита.');
    }

    const updated = await this.prisma.shiftSwap.update({
      where: { id },
      data: { status: 'CANCELLED', resolvedAt: new Date() },
      include: scheduleInclude,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.SWAP_CANCELLED,
      entity: 'ShiftSwap',
      entityId: id,
    });

    // Якщо хтось уже погодився — попередити його
    if (swap.claimerId) {
      await this.notifications.createNotification(swap.claimerId, {
        title: 'Пропозицію скасовано',
        message: 'Автор скасував обмін зміни, яку ви хотіли взяти.',
        category: 'schedule',
      });
    }

    this.events.emitToAll('invalidate_swaps');
    return updated;
  }

  /**
   * Стрічка обмінів для користувача:
   *  - available: відкриті пропозиції його відділень (або адресовані йому);
   *  - mine: власні пропозиції; claimed: які він забрав;
   *  - pendingApproval: очікують підтвердження (лише для MANAGE_SCHEDULE).
   */
  async list(actor: User) {
    const memberships = await this.prisma.department.findMany({
      where: { members: { some: { id: actor.id } } },
      select: { id: true },
    });
    const deptIds = memberships.map((d) => d.id);
    const canManage = hasPermission(actor as any, Permission.MANAGE_SCHEDULE);

    const [available, mine, claimed, pendingApproval] = await Promise.all([
      this.prisma.shiftSwap.findMany({
        where: {
          status: 'OPEN',
          requesterId: { not: actor.id },
          OR: [
            { targetUserId: actor.id },
            {
              targetUserId: null,
              schedule: { departmentId: { in: deptIds } },
            },
          ],
        },
        include: scheduleInclude,
        orderBy: { id: 'desc' },
      }),
      this.prisma.shiftSwap.findMany({
        where: { requesterId: actor.id },
        include: scheduleInclude,
        orderBy: { id: 'desc' },
        take: 50,
      }),
      this.prisma.shiftSwap.findMany({
        where: { claimerId: actor.id },
        include: scheduleInclude,
        orderBy: { id: 'desc' },
        take: 50,
      }),
      canManage
        ? this.prisma.shiftSwap.findMany({
            where: { status: 'CLAIMED' },
            include: scheduleInclude,
            orderBy: { id: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    return { available, mine, claimed, pendingApproval, canManage };
  }
}
