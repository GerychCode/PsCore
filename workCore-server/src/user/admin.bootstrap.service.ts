import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * При першому запуску (в базі немає жодного користувача) створює
 * суперадміністратора з випадковим паролем і виводить облікові дані в консоль.
 * Акаунт вимагає зміни пароля при першому вході.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger('AdminBootstrap');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) return;

    const email =
      this.config.get<string>('SUPERADMIN_EMAIL') ?? 'admin@workcore.local';
    // Читабельний випадковий пароль (base64 без спецсимволів для зручності)
    const password = randomBytes(9)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12);

    await this.prisma.user.create({
      data: {
        firstName: 'Super',
        lastName: 'Admin',
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'Admin',
        isEmailVerified: true,
        mustChangePassword: true,
      },
    });

    this.logger.warn(
      '\n' +
        '============================================================\n' +
        '  СТВОРЕНО СУПЕРАДМІНІСТРАТОРА (перший запуск)\n' +
        `  Логін (email): ${email}\n` +
        `  Пароль:        ${password}\n` +
        '  Змініть пароль одразу після першого входу.\n' +
        '============================================================',
    );
  }
}
