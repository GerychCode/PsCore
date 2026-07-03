import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { Authorization } from '../common/decorator/auth.decorator';
import { Authorized } from '../common/decorator/authorized.decorator';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @Authorization()
  getConversations(@Authorized('id') userId: number) {
    return this.chatService.getConversations(userId);
  }

  @Get('unread-count')
  @Authorization()
  getUnreadCount(@Authorized('id') userId: number) {
    return this.chatService.getUnreadCount(userId);
  }

  @Get('with/:userId')
  @Authorization()
  getConversation(
    @Authorized('id') userId: number,
    @Param('userId', ParseIntPipe) partnerId: number,
    @Query('cursor') cursor?: string,
  ) {
    const parsedCursor = cursor ? parseInt(cursor, 10) : undefined;
    return this.chatService.getConversation(
      userId,
      partnerId,
      Number.isNaN(parsedCursor) ? undefined : parsedCursor,
    );
  }

  @Patch('with/:userId/read')
  @Authorization()
  markConversationRead(
    @Authorized('id') userId: number,
    @Param('userId', ParseIntPipe) partnerId: number,
  ) {
    return this.chatService.markConversationRead(userId, partnerId);
  }
}
