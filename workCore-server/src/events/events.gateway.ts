import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { signedCookie } from 'cookie-parser';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');
  private userSockets = new Map<number, string[]>();

  constructor(
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async handleConnection(client: Socket) {
    const userId = await this.authenticate(client);

    if (!userId) {
      this.logger.warn(
        `Socket ${client.id} відхилено: немає валідної сесії`,
      );
      client.disconnect(true);
      return;
    }

    // userId зберігається на сокеті — його читають інші gateway (чат)
    client.data.userId = userId;

    const existingSockets = this.userSockets.get(userId) || [];
    existingSockets.push(client.id);
    this.userSockets.set(userId, existingSockets);
    this.logger.log(`User ${userId} connected with socket ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as number | undefined;
    if (!userId) return;

    let existingSockets = this.userSockets.get(userId) || [];
    existingSockets = existingSockets.filter((id) => id !== client.id);

    if (existingSockets.length > 0) {
      this.userSockets.set(userId, existingSockets);
    } else {
      this.userSockets.delete(userId);
    }
    this.logger.log(`User ${userId} disconnected from socket ${client.id}`);
  }

  /**
   * Автентифікує сокет за підписаною session-кукі (та сама сесія, що й у HTTP).
   * Довіряти query-параметрам не можна — клієнт може підставити чужий userId.
   */
  private async authenticate(client: Socket): Promise<number | null> {
    try {
      const cookieHeader = client.handshake.headers.cookie;
      if (!cookieHeader) return null;

      const sessionName = this.configService.getOrThrow<string>('SESSION_NAME');
      const rawCookie = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${sessionName}=`));
      if (!rawCookie) return null;

      const rawValue = decodeURIComponent(
        rawCookie.slice(sessionName.length + 1),
      );
      const sessionId = signedCookie(
        rawValue,
        this.configService.getOrThrow<string>('SESSION_SECRET'),
      );
      if (!sessionId || sessionId === rawValue) return null;

      const sessionKey = `${this.configService.getOrThrow<string>('SESSION_FOLDER')}${sessionId}`;
      const sessionJson = await this.redisClient.get(sessionKey);
      if (!sessionJson) return null;

      const session = JSON.parse(sessionJson);
      return typeof session.userId === 'number' ? session.userId : null;
    } catch {
      return null;
    }
  }

  emitToUser(userId: number, event: string, payload?: any) {
    const socketIds = this.userSockets.get(userId);
    if (socketIds && socketIds.length > 0) {
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit(event, payload);
      });
      return true;
    }
    return false;
  }

  emitToUsers(userIds: number[], event: string, payload?: any) {
    userIds.forEach((userId) => this.emitToUser(userId, event, payload));
  }

  emitToAll(event: string, payload?: any) {
    this.server.emit(event, payload);
  }
}
