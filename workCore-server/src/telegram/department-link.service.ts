import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

/** Redis-ключ коду прив'язки: код → departmentId. */
const DEP_LINK_KEY = 'dep-link:';
/** Код живе 5 хвилин — стільки ж, скільки код підтвердження зміни. */
export const DEP_LINK_TTL_SEC = 300;

/** Формат коду; має збігатися з @Hears-патерном у боті. */
export const DEP_LINK_PATTERN = /^DEP-[A-Z0-9]{5}$/i;

/**
 * Прив'язка Telegram-чату відділення. Єдине джерело правди для двох входів:
 * команди /departments у боті та кнопки в адмінці. Код доводить, що адмін
 * справді має доступ до чату — на відміну від ручного вводу chat id, де
 * помилка в цифрі тихо відправляла б коди присутності стороннім людям.
 */
@Injectable()
export class DepartmentLinkService {
  private readonly logger = new Logger('DepartmentLink');

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /** Генерує код без символів, які легко сплутати (0/O, 1/I). */
  private generateCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'DEP-';
    for (let i = 0; i < 5; i++) {
      code += alphabet[randomInt(0, alphabet.length)];
    }
    return code;
  }

  async createCode(departmentId: number) {
    const code = this.generateCode();
    await this.redis.set(
      `${DEP_LINK_KEY}${code}`,
      String(departmentId),
      'EX',
      DEP_LINK_TTL_SEC,
    );
    return { code, expiresInSec: DEP_LINK_TTL_SEC };
  }

  /**
   * Погашає код і прив'язує чат. Повертає null, якщо код невідомий
   * або протух — код одноразовий.
   */
  async consumeCode(code: string, chatId: string) {
    const key = `${DEP_LINK_KEY}${code.toUpperCase()}`;
    const departmentIdStr = await this.redis.get(key);
    if (!departmentIdStr) return null;

    const departmentId = parseInt(departmentIdStr, 10);
    const department = await this.prisma.department.update({
      where: { id: departmentId },
      data: { telegramId: chatId },
    });
    await this.redis.del(key);

    this.logger.log(
      `Відділення ${departmentId} прив'язано до Telegram-чату ${chatId}`,
    );
    return department;
  }

  /** Відв'язати чат — коди підтвердження більше нікуди не підуть. */
  async unlink(departmentId: number) {
    const department = await this.prisma.department.update({
      where: { id: departmentId },
      data: { telegramId: null },
    });
    this.logger.log(`Відділення ${departmentId} відв'язано від Telegram`);
    return { id: department.id, linked: false };
  }

  async status(departmentId: number) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, telegramId: true },
    });
    return department
      ? {
          id: department.id,
          name: department.name,
          linked: !!department.telegramId,
        }
      : null;
  }
}
