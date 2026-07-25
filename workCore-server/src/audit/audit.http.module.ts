import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuditController } from './audit.controller';

/**
 * HTTP-шар аудиту. Імпортує UserModule (потрібен AuthGuard/PermissionsGuard).
 * AuditService береться з глобального AuditModule — тож циклу з UserModule немає.
 */
@Module({
  imports: [UserModule],
  controllers: [AuditController],
})
export class AuditHttpModule {}
