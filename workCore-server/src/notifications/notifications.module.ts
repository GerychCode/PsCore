import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { EventsGateway } from '../events/events.gateway';
import { TelegramModule } from '../telegram/telegram.module';

@Global()
@Module({
  imports: [PrismaModule, UserModule, EventsGateway, TelegramModule],
  controllers: [NotificationsController],
  providers: [EventsGateway, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
