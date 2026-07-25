import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {UserService} from "../user/user.service";
import {User} from "../../generated/prisma";
import {Request, Response} from "express";
import {UserLoginDto} from "./dto/login.dto";
import * as bcrypt from 'bcrypt';
import {ConfigService} from "@nestjs/config";
import { Redis } from 'ioredis';
import {UserDto} from "../user/dto/user.dto";
import { MailService } from '../mail/mail.service';
import { rotateSingleUseToken } from '../common/utils/redis-token.util';

const VERIFY_PREFIX = 'verify-email:';
const RESET_PREFIX = 'password-reset:';
const VERIFY_TTL = 60 * 60 * 24; // 24 години
const RESET_TTL = 60 * 60; // 1 година

// Валідний bcrypt-хеш «нізвідки» — щоб при неіснуючій пошті логін усе одно
// витрачав час на bcrypt.compare (сталий час → без timing-enumeration).
const DUMMY_HASH =
  '$2b$12$prapSa872RB1E5ZYJxSRfu.MgZwks8y2xTJ9tbq3qSouoQjX5OUjS';

@Injectable()
export class AuthService {

  constructor(
      private userService: UserService,
      private configService: ConfigService,
      private readonly mailService: MailService,
      @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string,
  ) {
    const user = await this.userService.findByIdRaw(userId);
    if (!user) throw new BadRequestException('Користувача не знайдено.');

    const valid =
      !!user.passwordHash &&
      bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Поточний пароль невірний.');

    await this.userService.updatePassword(userId, newPassword);
    await this.userService.clearMustChangePassword(userId);
    // Зміна пароля вилогінює всі ІНШІ сесії (поточну лишаємо активною) —
    // на випадок, якщо стару сесію було скомпрометовано.
    await this.invalidateUserSessions(userId, currentSessionId);
    return { message: 'Пароль оновлено.' };
  }

  private async issueVerification(userId: number, email: string) {
    const token = await this.rotateToken(VERIFY_PREFIX, userId, VERIFY_TTL);
    await this.mailService.sendVerificationEmail(email, token);
  }

  /**
   * Створює новий токен і робить попередній (для цього ж користувача й типу)
   * недійсним — щоб водночас був живий лише один лінк.
   */
  private rotateToken(prefix: string, userId: number, ttl: number) {
    return rotateSingleUseToken(this.redisClient, prefix, userId, ttl);
  }

  /**
   * Знищує активні сесії користувача (Redis-стор connect-redis).
   * exceptSessionId — сесія, яку треба лишити (напр. поточна при зміні пароля).
   */
  private async invalidateUserSessions(userId: number, exceptSessionId?: string) {
    const prefix = this.configService.getOrThrow<string>('SESSION_FOLDER');
    const keepKey = exceptSessionId ? `${prefix}${exceptSessionId}` : null;
    const stream = this.redisClient.scanStream({
      match: `${prefix}*`,
      count: 100,
    });
    for await (const keys of stream) {
      for (const key of keys as string[]) {
        if (keepKey && key === keepKey) continue;
        const raw = await this.redisClient.get(key);
        if (!raw) continue;
        try {
          if (JSON.parse(raw).userId === userId) {
            await this.redisClient.del(key);
          }
        } catch {
          // не JSON-сесія — пропускаємо
        }
      }
    }
  }

  async verifyEmail(token: string) {
    const key = `${VERIFY_PREFIX}${token}`;
    const userIdStr = await this.redisClient.get(key);
    if (!userIdStr) {
      throw new BadRequestException(
        'Посилання недійсне або його час дії минув.',
      );
    }
    const userId = parseInt(userIdStr, 10);
    await this.userService.markEmailVerified(userId);
    await this.redisClient.del(key);
    await this.redisClient.del(`${VERIFY_PREFIX}user:${userId}`);
    return { message: 'Пошту підтверджено. Тепер ви можете увійти.' };
  }

  async resendVerification(email: string) {
    const user = await this.userService.findByEmail(email);
    // Не розкриваємо, чи існує акаунт
    if (user && !user.isEmailVerified) {
      await this.issueVerification(user.id, email);
    }
    return {
      message: 'Якщо акаунт існує й не підтверджений — лист надіслано.',
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);
    if (user) {
      const token = await this.rotateToken(RESET_PREFIX, user.id, RESET_TTL);
      await this.mailService.sendPasswordResetEmail(email, token);
    }
    // Завжди однакова відповідь — захист від перебору пошт
    return {
      message: 'Якщо акаунт існує — лист із посиланням надіслано.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const key = `${RESET_PREFIX}${token}`;
    const userIdStr = await this.redisClient.get(key);
    if (!userIdStr) {
      throw new BadRequestException(
        'Посилання недійсне або його час дії минув.',
      );
    }
    const userId = parseInt(userIdStr, 10);

    await this.userService.updatePassword(userId, newPassword);
    // Володіння поштою доведено листом — підтверджуємо адресу заразом
    await this.userService.markEmailVerified(userId);
    // Скидаємо токен і вилогінюємо всі старі сесії (могли бути скомпрометовані)
    await this.redisClient.del(key);
    await this.redisClient.del(`${RESET_PREFIX}user:${userId}`);
    await this.invalidateUserSessions(userId);

    return { message: 'Пароль оновлено. Тепер увійдіть з новим паролем.' };
  }

  async login(req: Request, userLoginDto: UserLoginDto) {
    const findUser = await this.userService.findByEmail(userLoginDto.email);

    // Єдине повідомлення + сталий час (bcrypt виконується завжди, навіть коли
    // акаунта немає) — щоб не можна було перебирати існуючі пошти.
    const passwordOk = bcrypt.compareSync(
      userLoginDto.password,
      findUser?.passwordHash || DUMMY_HASH,
    );
    if (!findUser || !findUser.passwordHash || !passwordOk) {
      throw new BadRequestException('Невірна пошта або пароль.');
    }

    if (!findUser.isEmailVerified) {
      throw new ForbiddenException(
        'Пошту не підтверджено. Перевірте лист або запросіть новий.',
      );
    }

    return this.saveSession(req, findUser);
  }

  logout(res: Response, req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy(err => {
        if(err){
         return reject( new InternalServerErrorException("Не вдалося завершити сесію!"))
        }
        const name = this.configService.getOrThrow<string>('SESSION_NAME')
        // clearCookie видаляє cookie лише з тими самими атрибутами, з якими
        // її ставили. Чистимо обидва варіанти: host-only (поточний) і з
        // Domain (легасі, коли SESSION_DOMAIN був заданий) — інакше cookie
        // лишається і мідлвар клієнта вважає користувача залогіненим
        res.clearCookie(name)
        res.clearCookie(name, { domain: req.hostname })
        resolve()
      })
    })
  }

  private async saveSession(req: Request, user: UserDto) {
    return new Promise((resolve, reject) => {
      // Захист від session fixation: видаємо НОВИЙ id сесії при вході,
      // щоб раніше «підсаджений» атакувальником id не отримав привілеї.
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          return reject(
            new InternalServerErrorException('Не вдалося створити сесію.'),
          );
        }

        req.session.userId = user.id;

        req.session.save((err) => {
          if (err) {
            return reject(
              new InternalServerErrorException(
                'Не вдалося зберегти сесію. Перевірте налаштування сесії.',
              ),
            );
          }
          resolve(undefined);
        });
      });
    });
  }

}
