import { Module } from '@nestjs/common';
import { ShiftSessionService } from './shift.session.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { EventsModule } from '../events/events.module';
import { TagRuleModule } from '../work.shift.tag/tag-rule.module';

@Module({
  imports: [PrismaModule, UserModule, EventsModule, TagRuleModule],
  providers: [ShiftSessionService],
  exports: [ShiftSessionService],
})
export class ShiftSessionModule {}
