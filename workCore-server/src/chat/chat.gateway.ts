import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ChatService } from './chat.service';
import { parseCorsOrigins } from '../common/utils/cors-origins';

interface SendMessagePayload {
  receiverId: number;
  content: string;
}

// Ліміт частоти надсилання: не більше 20 повідомлень за 10 секунд на користувача
const CHAT_RATE_LIMIT = 20;
const CHAT_RATE_WINDOW_SEC = 10;

/**
 * Особисті повідомлення через сокети.
 * Автентифікація виконується в EventsGateway.handleConnection —
 * сюди сокет потрапляє вже з client.data.userId.
 */
@WebSocketGateway({
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  },
})
export class ChatGateway {
  private readonly logger = new Logger('ChatGateway');

  constructor(
    private readonly chatService: ChatService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  /** Тротлінг WS-подій (глобальний HTTP-throttler на сокети не діє). */
  private async isRateLimited(userId: number): Promise<boolean> {
    const key = `ws-chat-rl:${userId}`;
    const count = await this.redisClient.incr(key);
    if (count === 1) {
      await this.redisClient.expire(key, CHAT_RATE_WINDOW_SEC);
    }
    return count > CHAT_RATE_LIMIT;
  }

  @SubscribeMessage('chat:send')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const senderId = client.data?.userId as number | undefined;
    if (!senderId) {
      return { error: 'Користувача не авторизовано' };
    }

    if (await this.isRateLimited(senderId)) {
      return { error: 'Забагато повідомлень. Трохи зачекайте.' };
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
