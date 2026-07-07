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
import { randomBytes } from 'crypto';
import {ConfigService} from "@nestjs/config";
import { Redis } from 'ioredis';
import {UserDto} from "../user/dto/user.dto";
import { MailService } from '../mail/mail.service';

const VERIFY_PREFIX = 'verify-email:';
const RESET_PREFIX = 'password-reset:';
const VERIFY_TTL = 60 * 60 * 24; // 24 години
const RESET_TTL = 60 * 60; // 1 година

@Injectable()
export class AuthService {

  constructor(
      private userService: UserService,
      private configService: ConfigService,
      private readonly mailService: MailService,
      @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userService.findByIdRaw(userId);
    if (!user) throw new BadRequestException('Користувача не знайдено.');

    const valid =
      !!user.passwordHash &&
      bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Поточний пароль невірний.');

    await this.userService.updatePassword(userId, newPassword);
    await this.userService.clearMustChangePassword(userId);
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
  private async rotateToken(prefix: string, userId: number, ttl: number) {
    const pointerKey = `${prefix}user:${userId}`;
    const previous = await this.redisClient.get(pointerKey);
    if (previous) {
      await this.redisClient.del(`${prefix}${previous}`);
    }
    const token = this.generateToken();
    await this.redisClient.set(`${prefix}${token}`, userId, 'EX', ttl);
    await this.redisClient.set(pointerKey, token, 'EX', ttl);
    return token;
  }

  /** Знищує всі активні сесії користувача (Redis-стор connect-redis). */
  private async invalidateUserSessions(userId: number) {
    const prefix = this.configService.getOrThrow<string>('SESSION_FOLDER');
    const stream = this.redisClient.scanStream({
      match: `${prefix}*`,
      count: 100,
    });
    for await (const keys of stream) {
      for (const key of keys as string[]) {
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

  async login(req: Request, userLoginDto: UserLoginDto){
    const findUser = await this.userService.findByEmail(userLoginDto.email);
    if(!findUser || !findUser.passwordHash){
      throw new BadRequestException("Пошту не знайено!");
    }

    const validPassword = bcrypt.compareSync(userLoginDto.password, findUser.passwordHash);
    if (!validPassword) throw new BadRequestException("Невірний пароль!");

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
        res.clearCookie(this.configService.getOrThrow<string>('SESSION_NAME'))
        resolve()
      })
    })
  }

  private async saveSession(req: Request, user: UserDto) {
    return new Promise((resolve, reject) => {
      req.session.userId= user.id;

      req.session.save(err => {
        if (err) {
          return reject(
              new InternalServerErrorException(
                  'Не удалось сохранить сессию. Проверьте, правильно ли настроены параметры сессии.'
              )
          );
        }

        resolve(undefined);
      });
    });
  }

}
