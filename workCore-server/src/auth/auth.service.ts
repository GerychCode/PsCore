import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {UserService} from "../user/user.service";
import {CreateUserDto} from "./dto/registration.dto";
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

  async create(req: Request, createUserDto: CreateUserDto){
    const isExistEmail = await this.userService.findByEmail(createUserDto.email);
    if(isExistEmail){
      throw new BadRequestException("Пошта вже використовується");
    }

    const newUser = await this.userService.create({
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: createUserDto.email,
      password: createUserDto.password,
      isEmailVerified: false,
    })

    await this.issueVerification(newUser.id, createUserDto.email);

    // Без автологіну — спершу підтвердження пошти
    return {
      message:
        'Акаунт створено. Перевірте пошту та підтвердьте адресу, щоб увійти.',
    };
  }

  private async issueVerification(userId: number, email: string) {
    const token = this.generateToken();
    await this.redisClient.set(
      `${VERIFY_PREFIX}${token}`,
      userId,
      'EX',
      VERIFY_TTL,
    );
    await this.mailService.sendVerificationEmail(email, token);
  }

  async verifyEmail(token: string) {
    const key = `${VERIFY_PREFIX}${token}`;
    const userIdStr = await this.redisClient.get(key);
    if (!userIdStr) {
      throw new BadRequestException(
        'Посилання недійсне або його час дії минув.',
      );
    }
    await this.userService.markEmailVerified(parseInt(userIdStr, 10));
    await this.redisClient.del(key);
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
      const token = this.generateToken();
      await this.redisClient.set(
        `${RESET_PREFIX}${token}`,
        user.id,
        'EX',
        RESET_TTL,
      );
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
    await this.userService.updatePassword(
      parseInt(userIdStr, 10),
      newPassword,
    );
    await this.redisClient.del(key);
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
