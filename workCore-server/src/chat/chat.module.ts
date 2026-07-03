import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { UserModule } from '../user/user.module';

@Module({
  // UserModule потрібен AuthGuard-у (@Authorization) в контролері
  imports: [PrismaModule, EventsModule, UserModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
