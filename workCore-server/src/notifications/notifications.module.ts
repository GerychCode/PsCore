import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { EventsGateway } from '../events/events.gateway';

@Global()
@Module({
  imports: [PrismaModule, UserModule, EventsGateway],
  controllers: [NotificationsController],
  providers: [EventsGateway, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
