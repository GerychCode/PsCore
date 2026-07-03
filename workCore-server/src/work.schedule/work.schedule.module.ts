import { Module } from '@nestjs/common';
import { WorkScheduleController } from './work.schedule.controller';
import { WorkScheduleService } from './work.schedule.service';
import { ScheduleGeneratorService } from './schedule.generator.service';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentService } from '../department/department.service';
import { UserService } from '../user/user.service';
import { FileStorageService } from '../file.storage/file.starage.service';
import { UserModule } from '../user/user.module';
import { EmployeeLevelModule } from '../employee.level/employee.level.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [UserModule, EmployeeLevelModule, EventsModule],
  controllers: [WorkScheduleController],
  providers: [
    WorkScheduleService,
    ScheduleGeneratorService,
    PrismaService,
    DepartmentService,
    UserService,
    FileStorageService,
  ],
})
export class WorkScheduleModule {}