import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { IsDevEnv } from './common/utils/is-dev.utils';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { DepartmentModule } from './department/department.module';
import { WorkShiftModule } from './work.shift/work.shift.module';
import { WorkScheduleModule } from './work.schedule/work.schedule.module';
import { WorkShiftTagModule } from './work.shift.tag/work.shift.tag.module';
import { EmployeeLevelModule } from './employee.level/employee.level.module';

import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { TelegramModule } from './telegram/telegram.module';
import { TelegrafModule } from 'nestjs-telegraf';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ChatModule } from './chat/chat.module';
import { ScheduleWishModule } from './schedule.wish/schedule.wish.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: !IsDevEnv,
    }),
    // Загальний ліміт: 100 запитів за хвилину з однієї IP-адреси
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UserModule,
    DepartmentModule,
    WorkShiftModule,
    WorkScheduleModule,
    WorkShiftTagModule,
    EmployeeLevelModule,
    TelegrafModule.forRoot({
      token: process.env.TELEGRAM_BOT_TOKEN,
    }),
    TelegramModule,
    ChatModule,
    ScheduleWishModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
