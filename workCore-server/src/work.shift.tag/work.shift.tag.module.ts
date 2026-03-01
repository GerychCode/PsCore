import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkShiftTagController } from './work.shift.tag.controller';
import { WorkShiftTagService } from './work.shift.tag.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [WorkShiftTagController],
  providers: [WorkShiftTagService],
  exports: [WorkShiftTagService],
})
export class WorkShiftTagModule {}
