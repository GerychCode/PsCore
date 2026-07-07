import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { UserModule } from '../user/user.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  // UserModule — для AuthGuard; TelegramModule — для дублювання чату в TG
  imports: [PrismaModule, EventsModule, UserModule, TelegramModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
