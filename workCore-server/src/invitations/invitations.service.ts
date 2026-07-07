import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { RolesService } from '../roles/roles.service';
import { MailService } from '../mail/mail.service';
import { CreateInvitationDto } from './dto/invitation.dto';

const INVITE_PREFIX = 'invite:';
const INVITE_TTL = 60 * 60 * 24 * 7; // 7 днів

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly rolesService: RolesService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  private clientUrl(): string {
    return (
      this.config.get<string>('CLIENT_URL') ??
      this.config.get<string>('CORS_ORIGIN') ??
      'http://localhost:3000'
    );
  }

  private buildLink(token: string) {
    return `${this.clientUrl()}/auth/register?token=${token}`;
  }

  /** Один активний токен на користувача. */
  private async issueToken(userId: number): Promise<string> {
    const pointerKey = `${INVITE_PREFIX}user:${userId}`;
    const previous = await this.redis.get(pointerKey);
    if (previous) await this.redis.del(`${INVITE_PREFIX}${previous}`);

    const token = randomBytes(32).toString('hex');
    await this.redis.set(`${INVITE_PREFIX}${token}`, userId, 'EX', INVITE_TTL);
    await this.redis.set(pointerKey, token, 'EX', INVITE_TTL);
    return token;
  }

  async createInvitation(dto: CreateInvitationDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userService.findByEmail(email);

    let userId: number;
    if (existing) {
      // Уже активний акаунт (має пароль) — повторно не запрошуємо
      if (existing.passwordHash) {
        throw new BadRequestException(
          'Користувач із такою поштою вже зареєстрований.',
        );
      }
      // Незавершене запрошення — оновлюємо ПІБ і перевидаємо токен
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { firstName: dto.firstName, lastName: dto.lastName },
      });
      userId = existing.id;
    } else {
      const user = await this.userService.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email,
        password: '', // порожній хеш = pending, увійти не можна
        isEmailVerified: false,
      });
      await this.rolesService.assignDefaultRole(user.id);
      userId = user.id;
    }

    const token = await this.issueToken(userId);
    return {
      userId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      token,
      registrationLink: this.buildLink(token),
    };
  }

  async sendInvitationEmail(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Користувача не знайдено.');
    if (user.passwordHash) {
      throw new BadRequestException('Користувач уже зареєстрований.');
    }
    // Беремо активний токен або видаємо новий
    const pointerKey = `${INVITE_PREFIX}user:${userId}`;
    let token = await this.redis.get(pointerKey);
    if (!token) token = await this.issueToken(userId);

    await this.mailService.sendInvitationEmail(
      user.email,
      token,
      user.firstName,
    );
    return { message: 'Запрошення надіслано на пошту.' };
  }

  /** Дані для префілу сторінки реєстрації. */
  async getInvitation(token: string) {
    const userId = await this.redis.get(`${INVITE_PREFIX}${token}`);
    if (!userId) {
      throw new NotFoundException('Запрошення недійсне або його час дії минув.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('Запрошення недійсне.');
    }
    return user;
  }

  async acceptInvitation(token: string, password: string) {
    const key = `${INVITE_PREFIX}${token}`;
    const userIdStr = await this.redis.get(key);
    if (!userIdStr) {
      throw new BadRequestException(
        'Запрошення недійсне або його час дії минув.',
      );
    }
    const userId = parseInt(userIdStr, 10);

    await this.userService.updatePassword(userId, password);
    await this.userService.markEmailVerified(userId);

    await this.redis.del(key);
    await this.redis.del(`${INVITE_PREFIX}user:${userId}`);

    return { message: 'Реєстрацію завершено. Тепер ви можете увійти.' };
  }
}
