import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Перевірте шлях до PrismaService
import { NotificationType } from '../../generated/prisma';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  // 1. Створення повідомлення (зберігає в БД і відправляє по сокетах)
  async createNotification(
    userId: number,
    data: { title: string; message: string; type?: NotificationType },
  ) {
    // Зберігаємо в БД
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
      },
    });

    // Відправляємо збережений об'єкт (з ID, isRead та createdAt) користувачу
    this.eventsGateway.emitToUser(userId, 'new_notification', notification);

    return notification;
  }

  async getUserNotifications(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(userId: number, notificationId: number) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteNotification(userId: number, notificationId: number) {
    const result = await this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId: userId,
      },
    });

    return result.count > 0;
  }
}
