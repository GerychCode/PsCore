import { Module } from '@nestjs/common';
import { WorkScheduleController } from './work.schedule.controller';
import { WorkScheduleService } from './work.schedule.service';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentService } from '../department/department.service';
import { UserService } from '../user/user.service';
import { FileStorageService } from '../file.storage/file.starage.service';
import {UserModule} from "../user/user.module";

@Module({
  imports: [UserModule],
  controllers: [WorkScheduleController],
  providers: [
    WorkScheduleService,
    PrismaService,
    DepartmentService,
    UserService,
    FileStorageService,
  ],
})
export class WorkScheduleModule {}