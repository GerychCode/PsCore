import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { TelegramService } from '../telegram/telegram.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let events: { emitToUser: jest.Mock };
  let telegram: { sendMessage: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    events = { emitToUser: jest.fn() };
    telegram = { sendMessage: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: events },
        { provide: TelegramService, useValue: telegram },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createNotification', () => {
    it('зберігає сповіщення та надсилає через WebSocket', async () => {
      prisma.user.findUnique.mockResolvedValue({ telegramId: null });
      prisma.notification.create.mockResolvedValue({ id: 1, title: 'Тест' });
      const res = await service.createNotification(5, {
        title: 'Тест',
        message: 'Повідомлення',
      });
      expect(events.emitToUser).toHaveBeenCalledWith(5, 'new_notification', {
        id: 1,
        title: 'Тест',
      });
      expect(telegram.sendMessage).not.toHaveBeenCalled();
      expect(res).toEqual({ id: 1, title: 'Тест' });
    });

    it('дублює в Telegram з різними іконками типів', async () => {
      prisma.user.findUnique.mockResolvedValue({ telegramId: '123456' });
      prisma.notification.create.mockResolvedValue({ id: 2, title: 'Готово' });

      for (const type of ['INFO', 'SUCCESS', 'WARNING', 'ERROR']) {
        await service.createNotification(5, {
          title: 'Готово',
          message: 'm',
          type: type as any,
        });
      }
      expect(telegram.sendMessage).toHaveBeenCalledTimes(4);
    });
  });

  describe('getUserNotifications', () => {
    it('повертає останні сповіщення користувача', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 1 }]);
      await expect(service.getUserNotifications(5)).resolves.toEqual([
        { id: 1 },
      ]);
    });
  });

  describe('markAsRead', () => {
    it('позначає конкретне сповіщення прочитаним', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });
      await service.markAsRead(5, 10);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 10, userId: 5 },
        data: { isRead: true },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('позначає всі сповіщення прочитаними', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });
      await service.markAllAsRead(5);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 5, isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe('deleteNotification', () => {
    it('повертає true, якщо запис видалено', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.deleteNotification(5, 10)).resolves.toBe(true);
    });

    it('повертає false, якщо нічого не видалено', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.deleteNotification(5, 10)).resolves.toBe(false);
    });
  });
});
