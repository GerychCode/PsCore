import { Global, Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module'; // Не забудьте імпортувати модуль Prisma

@Global()
@Module({
  imports: [PrismaModule, UserModule], // Потрібно для роботи з БД
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsGateway, NotificationsService], // Експортуємо Service, щоб викликати його в інших місцях
})
export class NotificationsModule {}
