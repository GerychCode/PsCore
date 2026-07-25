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

    const user = this.configService.get<string>('SMTP_USER');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure:
        (this.configService.get<string>('SMTP_SECURE') ?? 'false') === 'true',
      auth: {
        user,
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    this.warnAboutGmailPitfalls(host, user, port);

    // Перевіряємо зʼєднання одразу: інакше про невірний пароль дізнаємось
    // лише тоді, коли комусь не дійде запрошення — а send() помилки ковтає.
    void this.transporter
      .verify()
      .then(() => this.logger.log(`SMTP готовий: ${host}:${port}`))
      .catch((e: Error) =>
        this.logger.error(
          `SMTP не відповідає (${host}:${port}): ${e.message}. ` +
            'Листи не надсилатимуться.',
        ),
      );
  }

  /**
   * Дві помилки, на яких спотикається кожен, хто вмикає Gmail:
   * звичайний пароль замість App Password і From, відмінний від акаунта.
   */
  private warnAboutGmailPitfalls(host: string, user?: string, port?: number) {
    if (!host.includes('gmail')) return;

    const from = this.configService.get<string>('SMTP_FROM');
    const pass = this.configService.get<string>('SMTP_PASS') ?? '';

    // App Password — 16 символів, які Google показує групами по 4
    if (pass.replace(/\s/g, '').length !== 16) {
      this.logger.warn(
        'SMTP_PASS не схожий на App Password Google (16 символів). ' +
          'Звичайний пароль акаунта Gmail більше не приймає — ' +
          'створіть App Password у налаштуваннях безпеки Google.',
      );
    }

    if (from && user && !from.includes(user)) {
      this.logger.warn(
        `SMTP_FROM (${from}) не збігається з SMTP_USER (${user}). ` +
          'Gmail усе одно підставить адресу акаунта, тож лист прийде не з тієї ' +
          'адреси, яку ви очікуєте.',
      );
    }

    if (port === 465) {
      this.logger.warn(
        'Для порту 465 у Gmail потрібно SMTP_SECURE=true; для 587 — false.',
      );
    }
  }

  /** Чи налаштована реальна відправка (для діагностики в адмінці). */
  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /** Тестовий лист — щоб перевірити конфігурацію, не чекаючи запрошення. */
  async sendTestEmail(to: string): Promise<{ sent: boolean; reason?: string }> {
    if (!this.transporter) {
      return { sent: false, reason: 'SMTP не налаштовано (dev-режим)' };
    }
    const from =
      this.configService.get<string>('SMTP_FROM') ?? 'no-reply@workcore.app';
    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: 'Перевірка пошти — WorkCore',
        html: '<p>Якщо ви бачите цей лист, надсилання листів працює.</p>',
      });
      return { sent: true };
    } catch (error) {
      const reason = (error as Error).message;
      this.logger.error(`Тестовий лист на ${to} не пішов: ${reason}`);
      return { sent: false, reason };
    }
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
