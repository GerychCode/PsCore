import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { RolesModule } from '../roles/roles.module';
import { MailModule } from '../mail/mail.module';

@Module({
  // UserModule дає UserService + REDIS_CLIENT (і AuthGuard для @RequirePermissions)
  imports: [PrismaModule, UserModule, RolesModule, MailModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
