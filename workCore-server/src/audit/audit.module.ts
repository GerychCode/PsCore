import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from './audit.service';

/**
 * @Global — AuditService доступний усім модулям без явного import, щоб дописувати
 * аудит у різних сервісах. Свідомо НЕ імпортує UserModule і не тримає контролер:
 * інакше виник би цикл (UserService залежить від AuditService). HTTP-ендпоінт
 * винесено в AuditHttpModule.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
