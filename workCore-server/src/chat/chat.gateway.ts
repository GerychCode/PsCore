import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';

interface SendMessagePayload {
  receiverId: number;
  content: string;
}

/**
 * Особисті повідомлення через сокети.
 * Автентифікація виконується в EventsGateway.handleConnection —
 * сюди сокет потрапляє вже з client.data.userId.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway {
  private readonly logger = new Logger('ChatGateway');

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('chat:send')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const senderId = client.data?.userId as number | undefined;
    if (!senderId) {
      return { error: 'Користувача не авторизовано' };
    }

    try {
      const message = await this.chatService.sendMessage(
        senderId,
        Number(payload?.receiverId),
        payload?.content,
      );
      return { message };
    } catch (error) {
      this.logger.warn(
        `chat:send від user ${senderId} відхилено: ${error.message}`,
      );
      return { error: error.message ?? 'Не вдалося надіслати повідомлення' };
    }
  }

  @SubscribeMessage('chat:read')
  async onMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { partnerId: number },
  ) {
    const userId = client.data?.userId as number | undefined;
    if (!userId) {
      return { error: 'Користувача не авторизовано' };
    }

    const partnerId = Number(payload?.partnerId);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return { error: 'Невірний співрозмовник' };
    }

    return this.chatService.markConversationRead(userId, partnerId);
  }
}
