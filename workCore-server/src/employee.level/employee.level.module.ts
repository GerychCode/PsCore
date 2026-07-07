import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { EmployeeLevelService } from './employee.level.service';
import { EmployeeLevelController } from './employee.level.controller';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [EmployeeLevelController],
  providers: [EmployeeLevelService],
  exports: [EmployeeLevelService],
})
export class EmployeeLevelModule {}
