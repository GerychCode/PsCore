import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger('MailService');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('SMTP_HOST');
    if (!host) {
      // Без SMTP — dev-режим: листи лише логуються (лінк видно в консолі)
      this.logger.warn(
        'SMTP не налаштовано — листи будуть лише виводитись у лог (dev-режим).',
      );
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.configService.get<string>('SMTP_PORT') ?? 587),
      secure:
        (this.configService.get<string>('SMTP_SECURE') ?? 'false') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  private clientUrl(): string {
    // Куди веде лінк на фронті — базуємось на дозволеному origin
    return (
      this.configService.get<string>('CLIENT_URL') ??
      this.configService.get<string>('CORS_ORIGIN') ??
      'http://localhost:3000'
    );
  }

  private async send(to: string, subject: string, html: string, link: string) {
    if (!this.transporter) {
      this.logger.log(`[DEV MAIL] До: ${to} | ${subject}\n  Лінк: ${link}`);
      return;
    }
    const from =
      this.configService.get<string>('SMTP_FROM') ?? 'no-reply@workcore.app';
    try {
      await this.transporter.sendMail({ from, to, subject, html });
    } catch (error) {
      // Збій SMTP не має валити запит (інакше різні статуси розкривають
      // існування пошти) і не має скасовувати вже створений акаунт
      this.logger.error(
        `Не вдалося надіслати лист "${subject}" на ${to}: ${
          (error as Error).message
        }`,
      );
    }
  }

  async sendVerificationEmail(to: string, token: string) {
    const link = `${this.clientUrl()}/auth/verify-email?token=${token}`;
    await this.send(
      to,
      'Підтвердження пошти — WorkCore',
      `<p>Вітаємо у WorkCore!</p>
       <p>Щоб підтвердити пошту, перейдіть за посиланням:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Посилання дійсне 24 години.</p>`,
      link,
    );
  }

  async sendInvitationEmail(to: string, token: string, name?: string) {
    const link = `${this.clientUrl()}/auth/registration?token=${token}`;
    await this.send(
      to,
      'Запрошення до WorkCore',
      `<p>${name ? `Вітаємо, ${name}!` : 'Вітаємо!'}</p>
       <p>Вас запросили приєднатися до WorkCore. Завершіть реєстрацію
       (задайте пароль) за посиланням:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Посилання дійсне 7 днів.</p>`,
      link,
    );
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const link = `${this.clientUrl()}/auth/reset-password?token=${token}`;
    await this.send(
      to,
      'Скидання пароля — WorkCore',
      `<p>Ви запросили скидання пароля.</p>
       <p>Перейдіть за посиланням, щоб задати новий пароль:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Посилання дійсне 1 годину. Якщо це були не ви — проігноруйте лист.</p>`,
      link,
    );
  }
}
