import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { ShiftSwapService } from './shift.swap.service';
import { ShiftSwapController } from './shift.swap.controller';

@Module({
  // UserModule — для AuthGuard/PermissionsGuard; Notifications/Audit/Events @Global
  imports: [PrismaModule, UserModule],
  controllers: [ShiftSwapController],
  providers: [ShiftSwapService],
})
export class ShiftSwapModule {}
