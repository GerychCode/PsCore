import { Module } from '@nestjs/common';
import { ScheduleWishService } from './schedule.wish.service';
import { ScheduleWishController } from './schedule.wish.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';

@Module({
  // UserModule — для AuthGuard (@Authorization)
  imports: [PrismaModule, UserModule],
  controllers: [ScheduleWishController],
  providers: [ScheduleWishService],
  exports: [ScheduleWishService],
})
export class ScheduleWishModule {}
