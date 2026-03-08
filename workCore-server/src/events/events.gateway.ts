import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

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

  handleConnection(client: Socket) {
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
