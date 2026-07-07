import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '../../generated/prisma';
import { EventsGateway } from '../events/events.gateway';
import { TelegramService } from '../telegram/telegram.service';
import {
  NotificationCategory,
  isChannelEnabled,
} from './notification.prefs';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private readonly telegramService: TelegramService,
  ) {}

  async createNotification(
    userId: number,
    data: {
      title: string;
      message: string;
      type?: NotificationType;
      category?: NotificationCategory;
    },
  ) {
    const category = data.category ?? 'shift';
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, notificationPrefs: true },
    });
    const prefs = (user?.notificationPrefs as any) ?? null;

    let notification: any = null;

    // Веб-канал (in-app дзвіночок) — лише якщо увімкнено для категорії
    if (isChannelEnabled(prefs, category, 'web')) {
      notification = await this.prisma.notification.create({
        data: {
          userId,
          title: data.title,
          message: data.message,
          type: data.type || 'INFO',
        },
      });
      this.eventsGateway.emitToUser(userId, 'new_notification', notification);
    }

    // Telegram-канал — незалежно від веб
    if (user?.telegramId && isChannelEnabled(prefs, category, 'telegram')) {
      let icon = 'ℹ️';
      if (data.type === 'SUCCESS') icon = '✅';
      if (data.type === 'WARNING') icon = '⚠️';
      if (data.type === 'ERROR') icon = '❌';

      const tgMessage = `${icon} <b>${data.title}</b>\n\n${data.message}`;
      await this.telegramService.sendMessage(user.telegramId, tgMessage);
    }

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
