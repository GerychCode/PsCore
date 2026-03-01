import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

// Налаштовуємо CORS, щоб фронтенд міг підключитися
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotificationsGateway');

  // Зберігаємо зв'язок: userId -> масив socketId (користувач може відкрити кілька вкладок)
  private userSockets = new Map<number, string[]>();

  handleConnection(client: Socket) {
    // Отримуємо ID користувача при підключенні (передамо його з фронтенду)
    const userId = Number(client.handshake.query.userId);

    if (userId && !isNaN(userId)) {
      const existingSockets = this.userSockets.get(userId) || [];
      existingSockets.push(client.id);
      this.userSockets.set(userId, existingSockets);
      this.logger.log(`User ${userId} connected with socket ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = Number(client.handshake.query.userId);

    if (userId && !isNaN(userId)) {
      let existingSockets = this.userSockets.get(userId) || [];
      existingSockets = existingSockets.filter((id) => id !== client.id);

      if (existingSockets.length > 0) {
        this.userSockets.set(userId, existingSockets);
      } else {
        this.userSockets.delete(userId);
      }
      this.logger.log(`User ${userId} disconnected from socket ${client.id}`);
    }
  }

  sendNotificationToUser(
    userId: number,
    payload: { title: string; message: string; type?: string },
  ) {
    const socketIds = this.userSockets.get(userId);

    if (socketIds && socketIds.length > 0) {
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit('new_notification', payload);
      });
      return true;
    }
    return false;
  }
}
