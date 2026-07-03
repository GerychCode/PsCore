import { Module } from '@nestjs/common';
import { ShiftSessionService } from './shift.session.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, UserModule, EventsModule],
  providers: [ShiftSessionService],
  exports: [ShiftSessionService],
})
export class ShiftSessionModule {}
