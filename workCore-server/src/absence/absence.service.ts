import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  differenceInCalendarDays,
  endOfYear,
  startOfDay,
  startOfYear,
} from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.actions';
import { $Enums, User } from '../../generated/prisma';
import { hasPermission } from '../common/permissions/permissions.util';
import { Permission } from '../common/permissions/permission.enum';
import { fullName } from '../common/utils/full-name';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { AbsenceQueryDto } from './dto/absence-query.dto';
import { ReviewAbsenceDto } from './dto/review-absence.dto';

import AbsenceType = $Enums.AbsenceType;
import AbsenceStatus = $Enums.AbsenceStatus;

/** Статуси, що займають дні: за ними людина вважається недоступною. */
const ACTIVE_STATUSES: AbsenceStatus[] = ['PENDING', 'APPROVED'];

const DEFAULT_VACATION_DAYS = 24;

const canManage = (user: User) =>
  hasPermission(user as any, Permission.MANAGE_SCHEDULE);

const TYPE_LABELS: Record<AbsenceType, string> = {
  VACATION: 'Відпустка',
  SICK: 'Лікарняний',
  UNPAID: 'Відгул за свій рахунок',
  OTHER: 'Відсутність',
};

@Injectable()
export class AbsenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  /** Кількість календарних днів у проміжку, обидві межі включно. */
  private dayCount(start: Date, end: Date): number {
    return differenceInCalendarDays(end, start) + 1;
  }

  /**
   * Залишок оплачуваної відпустки на рік. Рахуємо за роком ПОЧАТКУ
   * відсутності: відпустка, що переходить через Новий рік, списується
   * з року, в якому почалась, — інакше один запит довелося б ділити навпіл.
   */
  async vacationBalance(userId: number, year = new Date().getFullYear()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { vacationDaysPerYear: true },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено.');

    const entitled = user.vacationDaysPerYear ?? DEFAULT_VACATION_DAYS;
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 0, 1));

    const taken = await this.prisma.absence.findMany({
      where: {
        userId,
        type: 'VACATION',
        status: { in: ACTIVE_STATUSES },
        startDate: { gte: yearStart, lte: yearEnd },
      },
      select: { startDate: true, endDate: true, status: true },
    });

    let used = 0;
    let pending = 0;
    for (const a of taken) {
      const days = this.dayCount(a.startDate, a.endDate);
      if (a.status === 'APPROVED') used += days;
      else pending += days;
    }

    return {
      year,
      entitled,
      used,
      pending,
      // Заброньоване чекає рішення, але вже не має вважатись доступним:
      // інакше можна подати кілька заявок на ті самі дні понад норму.
      remaining: Math.max(0, entitled - used - pending),
    };
  }

  private async assertNoOverlap(
    userId: number,
    start: Date,
    end: Date,
    excludeId?: number,
  ) {
    const clash = await this.prisma.absence.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_STATUSES },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        // Проміжки перетинаються, якщо початок одного не пізніший за
        // кінець другого і навпаки
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (clash) {
      throw new BadRequestException(
        'На ці дні вже є заявка на відсутність або погоджена відсутність.',
      );
    }
  }

  async create(actor: User, dto: CreateAbsenceDto) {
    const targetUserId =
      canManage(actor) && dto.userId ? dto.userId : actor.id;

    const start = startOfDay(new Date(dto.startDate));
    const end = startOfDay(new Date(dto.endDate));

    if (end < start) {
      throw new BadRequestException(
        'Дата завершення не може бути раніша за дату початку.',
      );
    }

    // Заднім числом заявку подати не можна — крім менеджера, який оформлює
    // лікарняний, про який дізналися постфактум.
    if (start < startOfDay(new Date()) && !canManage(actor)) {
      throw new BadRequestException('Не можна подати заявку на минулі дні.');
    }

    await this.assertNoOverlap(targetUserId, start, end);

    if (dto.type === 'VACATION') {
      const balance = await this.vacationBalance(
        targetUserId,
        start.getFullYear(),
      );
      const requested = this.dayCount(start, end);
      if (requested > balance.remaining) {
        throw new BadRequestException(
          `Недостатньо днів відпустки: запитано ${requested}, доступно ${balance.remaining}.`,
        );
      }
    }

    // Менеджер, оформлюючи відсутність, одразу її й погоджує: окремий
    // крок «сам подав — сам підтвердив» нікому не потрібен.
    const selfApproved = canManage(actor);

    const absence = await this.prisma.absence.create({
      data: {
        userId: targetUserId,
        type: dto.type,
        startDate: start,
        endDate: end,
        reason: dto.reason,
        status: selfApproved ? 'APPROVED' : 'PENDING',
        ...(selfApproved
          ? { reviewedById: actor.id, reviewedAt: new Date() }
          : {}),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.ABSENCE_CREATED,
      entity: 'Absence',
      entityId: absence.id,
      metadata: { userId: targetUserId, type: dto.type },
    });

    if (selfApproved) {
      const freed = await this.releaseSchedules(absence);
      this.events.emitToAll('invalidate_schedules');
      await this.notifyOwner(absence, 'Відсутність оформлено');
      return { ...absence, freedScheduleDays: freed };
    }

    // Менеджерам — щоб заявка не лежала непоміченою
    const managers = await this.findManagers();
    for (const id of managers) {
      await this.notifications.createNotification(id, {
        title: 'Нова заявка на відсутність',
        message: `${fullName(actor)}: ${TYPE_LABELS[dto.type]}, ${this.dayCount(start, end)} дн.`,
        category: 'schedule',
      });
    }

    this.events.emitToAll('invalidate_absences');
    return absence;
  }

  /**
   * Прибирає планові зміни на дні погодженої відсутності.
   *
   * Мовчки лишати їх не можна: людина у відпустці, а в графіку стоїть.
   * Повертаємо кількість звільнених днів, щоб менеджер побачив, що
   * покриття зменшилось, і за потреби перегенерував тиждень.
   */
  private async releaseSchedules(absence: {
    userId: number;
    startDate: Date;
    endDate: Date;
  }) {
    const result = await this.prisma.workSchedule.deleteMany({
      where: {
        userId: absence.userId,
        date: { gte: absence.startDate, lte: absence.endDate },
      },
    });
    return result.count;
  }

  private async findManagers(): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { role: 'Admin' },
          { appRoles: { some: { permissions: { has: 'MANAGE_SCHEDULE' } } } },
        ],
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async notifyOwner(
    absence: { userId: number; type: AbsenceType; startDate: Date },
    title: string,
    extra = '',
  ) {
    await this.notifications.createNotification(absence.userId, {
      title,
      message:
        `${TYPE_LABELS[absence.type]} з ` +
        `${absence.startDate.toLocaleDateString('uk-UA')}. ${extra}`.trim(),
      category: 'schedule',
    });
  }

  private async load(id: number) {
    const absence = await this.prisma.absence.findUnique({ where: { id } });
    if (!absence) throw new NotFoundException('Заявку не знайдено.');
    return absence;
  }

  async approve(actor: User, id: number, dto: ReviewAbsenceDto) {
    const absence = await this.load(id);
    if (absence.status !== 'PENDING') {
      throw new BadRequestException('Заявку вже розглянуто.');
    }

    // Стан міг змінитись, поки заявка лежала: за цей час людині могли
    // оформити іншу відсутність або вичерпати баланс відпустки.
    await this.assertNoOverlap(
      absence.userId,
      absence.startDate,
      absence.endDate,
      absence.id,
    );

    const updated = await this.prisma.absence.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewComment: dto.comment,
      },
    });

    const freed = await this.releaseSchedules(updated);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.ABSENCE_APPROVED,
      entity: 'Absence',
      entityId: id,
      metadata: { userId: absence.userId, freedScheduleDays: freed },
    });

    await this.notifyOwner(
      updated,
      'Відсутність погоджено',
      dto.comment ?? '',
    );

    this.events.emitToAll('invalidate_absences');
    this.events.emitToAll('invalidate_schedules');
    return { ...updated, freedScheduleDays: freed };
  }

  async reject(actor: User, id: number, dto: ReviewAbsenceDto) {
    const absence = await this.load(id);
    if (absence.status !== 'PENDING') {
      throw new BadRequestException('Заявку вже розглянуто.');
    }

    const updated = await this.prisma.absence.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewComment: dto.comment,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.ABSENCE_REJECTED,
      entity: 'Absence',
      entityId: id,
      metadata: { userId: absence.userId },
    });

    await this.notifyOwner(
      updated,
      'Відсутність відхилено',
      dto.comment ?? '',
    );

    this.events.emitToAll('invalidate_absences');
    return updated;
  }

  async cancel(actor: User, id: number) {
    const absence = await this.load(id);

    if (absence.userId !== actor.id && !canManage(actor)) {
      throw new ForbiddenException('Скасувати може лише автор або менеджер.');
    }
    if (!ACTIVE_STATUSES.includes(absence.status)) {
      throw new BadRequestException('Заявку вже закрито.');
    }
    // Погоджену відсутність, що вже почалась, автор скасувати не може:
    // дні пройшли, і мовчки «повернути» їх у баланс було б підробкою обліку.
    if (
      absence.status === 'APPROVED' &&
      absence.startDate <= startOfDay(new Date()) &&
      !canManage(actor)
    ) {
      throw new BadRequestException(
        'Відсутність уже почалась — скасування лише через менеджера.',
      );
    }

    const updated = await this.prisma.absence.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.ABSENCE_CANCELLED,
      entity: 'Absence',
      entityId: id,
      metadata: { userId: absence.userId },
    });

    if (absence.userId !== actor.id) {
      await this.notifyOwner(updated, 'Відсутність скасовано');
    }

    this.events.emitToAll('invalidate_absences');
    return updated;
  }

  async list(actor: User, query: AbsenceQueryDto) {
    const manage = canManage(actor);

    return this.prisma.absence.findMany({
      where: {
        // Без прав видно лише власні заявки
        ...(manage ? (query.userId ? { userId: query.userId } : {}) : { userId: actor.id }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.from || query.to
          ? {
              startDate: { ...(query.to && { lte: new Date(query.to) }) },
              endDate: { ...(query.from && { gte: new Date(query.from) }) },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 200,
    });
  }

  /**
   * Користувачі, недоступні в межах проміжку (погоджені відсутності).
   * Використовує генератор графіка — там це ТВЕРДА заборона.
   */
  async absentUserIds(from: Date, to: Date): Promise<Map<number, Date[]>> {
    const absences = await this.prisma.absence.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: to },
        endDate: { gte: from },
      },
      select: { userId: true, startDate: true, endDate: true },
    });

    const byUser = new Map<number, Date[]>();
    for (const a of absences) {
      const days = byUser.get(a.userId) ?? [];
      const cursor = new Date(Math.max(a.startDate.getTime(), from.getTime()));
      const last = new Date(Math.min(a.endDate.getTime(), to.getTime()));
      while (cursor <= last) {
        days.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      byUser.set(a.userId, days);
    }
    return byUser;
  }
}
