import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActionType } from './audit.actions';
import { AuditQueryDto } from './dto/audit-query.dto';

export interface AuditEntry {
  /** null = системна дія (напр. авто-завершення зміни) */
  actorId?: number | null;
  action: AuditActionType;
  entity: string;
  entityId?: number | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Записує подію аудиту. Свідомо «best-effort»: збій запису НЕ має валити
   * основну дію (підтвердження зміни, видалення ролі тощо).
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata as any) ?? undefined,
          ip: entry.ip ?? undefined,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Не вдалося записати аудит ${entry.action}: ${(e as Error).message}`,
      );
    }
  }

  /** Стрічка аудиту з фільтрами й курсорною пагінацією. */
  async list(query: AuditQueryDto) {
    const where = {
      ...(query.entity && { entity: query.entity }),
      ...(query.action && { action: query.action }),
      ...(query.actorId && { actorId: query.actorId }),
    };
    const take = Math.min(query.limit ?? 50, 100);

    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { id: 'desc' },
      take,
      ...(query.cursor && { skip: 1, cursor: { id: query.cursor } }),
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    return {
      items,
      nextCursor:
        items.length === take ? items[items.length - 1].id : null,
    };
  }
}
