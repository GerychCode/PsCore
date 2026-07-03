import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { EventsModule } from '../events/events.module';
import { TelegramModule } from '../telegram/telegram.module';

@Global()
@Module({
  // EventsGateway береться з EventsModule — окремий інстанс у providers
  // створював би другу мапу сокетів, і сповіщення губилися б
  imports: [PrismaModule, UserModule, EventsModule, TelegramModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
