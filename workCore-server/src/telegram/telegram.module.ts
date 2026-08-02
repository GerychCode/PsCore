import { Module } from '@nestjs/common';
import { TelegramUpdate } from './telegram.update';
import { TelegramService } from './telegram.service';
import { DepartmentLinkService } from './department-link.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { ShiftSessionModule } from '../work.shift/shift.session.module';

@Module({
  imports: [PrismaModule, UserModule, ShiftSessionModule],
  providers: [TelegramUpdate, TelegramService, DepartmentLinkService],
  exports: [TelegramService, DepartmentLinkService],
})
export class TelegramModule {}
