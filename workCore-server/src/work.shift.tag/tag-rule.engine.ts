import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { renderTemplate, ruleMatches } from './tag-rule.evaluator';
import { fullName } from '../common/utils/full-name';
import {
  RuleTrigger,
  ShiftRuleContext,
  TagRule,
  TemplateContext,
} from './tag-rule.types';

/**
 * Рушій кастомних правил тегів. Завантажує автозастосовні теги, перевіряє їхні
 * умови проти контексту зміни, навішує ті, що збіглися, і виконує їхні дії
 * (сповіщення). Best-effort: будь-який збій НЕ валить основний потік зміни.
 */
@Injectable()
export class TagRuleEngine {
  private readonly logger = new Logger('TagRuleEngine');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async apply(
    trigger: RuleTrigger,
    shiftId: number,
    ctx: ShiftRuleContext,
  ): Promise<number[]> {
    try {
      const tags = await this.prisma.tag.findMany({
        where: { autoApply: true, isSystem: false },
      });

      const matched = tags.filter((t) =>
        ruleMatches(t.rule as unknown as TagRule | null, trigger, ctx),
      );
      if (matched.length === 0) return [];

      await this.prisma.workShift.update({
        where: { id: shiftId },
        data: { tags: { connect: matched.map((t) => ({ id: t.id })) } },
      });

      // Ім'я власника — для шаблонів; тягнемо один раз, лише коли є що робити
      const owner = await this.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { firstName: true, lastName: true },
      });
      const userName = owner ? fullName(owner) : '';

      for (const tag of matched) {
        await this.runActions(tag, { ...ctx, userName, tagName: tag.name });
      }
      return matched.map((t) => t.id);
    } catch (e) {
      this.logger.warn(
        `Правила тегів не застосовано до зміни ${shiftId}: ${(e as Error).message}`,
      );
      return [];
    }
  }

  private async runActions(
    tag: { name: string; rule: unknown },
    tctx: TemplateContext,
  ) {
    const rule = tag.rule as TagRule | null;
    const actions = rule?.actions ?? [];
    if (actions.length === 0) return;

    for (const action of actions) {
      const title = renderTemplate(
        action.title || `Спрацював тег «${tag.name}»`,
        tctx,
      );
      const message = renderTemplate(action.message || '', tctx);

      if (action.type === 'NOTIFY_USER') {
        await this.notifications.createNotification(tctx.userId, {
          title,
          message,
          category: 'shift',
        });
      } else if (action.type === 'NOTIFY_MANAGERS') {
        const managerIds = await this.findManagers();
        for (const id of managerIds) {
          await this.notifications.createNotification(id, {
            title,
            message,
            category: 'shift',
          });
        }
      }
    }
  }

  /** Користувачі, що мають право APPROVE_SHIFTS (або enum-адміни). */
  private async findManagers(): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { role: 'Admin' },
          { appRoles: { some: { permissions: { has: 'APPROVE_SHIFTS' } } } },
        ],
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}
