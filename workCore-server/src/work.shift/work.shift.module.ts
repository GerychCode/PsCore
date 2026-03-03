import { Module } from '@nestjs/common';
import { WorkShiftService } from './work.shift.service';
import { WorkShiftController } from './work.shift.controller';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { FileStorageService } from '../file.storage/file.starage.service';
import { DepartmentService } from '../department/department.service';
import { UserModule } from '../user/user.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule, UserModule, NotificationsModule],
  controllers: [WorkShiftController],
  providers: [
    WorkShiftService,
    PrismaService,
    UserService,
    FileStorageService,
    DepartmentService,
  ],
})
export class WorkShiftModule {}
