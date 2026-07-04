import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  // UserModule експортує REDIS_CLIENT; RolesModule дає RolesService для дефолт-ролі
  imports: [UserModule, MailModule, RolesModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
