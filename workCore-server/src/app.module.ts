import { Module } from '@nestjs/common';
import {IsDevEnv} from "./common/utils/is-dev.utils";
import {ConfigModule} from "@nestjs/config";
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import {PrismaService} from "./prisma/prisma.service";
import { DepartmentModule } from './department/department.module';
import { WorkShiftModule } from './work.shift/work.shift.module';
import { WorkScheduleModule } from './work.schedule/work.schedule.module';


@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: !IsDevEnv,
  }), PrismaModule, AuthModule, UserModule, DepartmentModule, WorkShiftModule, WorkScheduleModule, WorkScheduleModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
