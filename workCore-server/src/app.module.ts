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

import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: !IsDevEnv,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    DepartmentModule,
    WorkShiftModule,
    WorkScheduleModule,
    WorkShiftTagModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
