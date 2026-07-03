import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let events: { emitToUser: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 2 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      chatMessage: {
        create: jest.fn().mockResolvedValue({
          id: 10,
          senderId: 1,
          receiverId: 2,
          content: 'Привіт',
        }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    events = { emitToUser: jest.fn() };
    service = new ChatService(prisma, events as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('sendMessage', () => {
    it('зберігає повідомлення і сповіщає обох', async () => {
      const message = await service.sendMessage(1, 2, '  Привіт  ');
      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: { senderId: 1, receiverId: 2, content: 'Привіт' },
      });
      expect(events.emitToUser).toHaveBeenCalledWith(
        2,
        'chat:message',
        message,
      );
      expect(events.emitToUser).toHaveBeenCalledWith(
        1,
        'chat:message',
        message,
      );
    });

    it('забороняє писати самому собі', async () => {
      await expect(service.sendMessage(1, 1, 'text')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('відхиляє порожнє повідомлення', async () => {
      await expect(service.sendMessage(1, 2, '   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('відхиляє надто довге повідомлення', async () => {
      await expect(
        service.sendMessage(1, 2, 'а'.repeat(2001)),
      ).rejects.toThrow(BadRequestException);
    });

    it('відхиляє невалідний receiverId', async () => {
      await expect(service.sendMessage(1, NaN, 'text')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('кидає NotFound, якщо отримувача не існує', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.sendMessage(1, 99, 'text')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getConversation', () => {
    it('фільтрує за парою користувачів і повертає хронологічний порядок', async () => {
      prisma.chatMessage.findMany.mockResolvedValue([{ id: 2 }, { id: 1 }]);
      const res = await service.getConversation(1, 2);
      expect(res.messages).toEqual([{ id: 1 }, { id: 2 }]);
      expect(res.hasMore).toBe(false);
      const arg = prisma.chatMessage.findMany.mock.calls[0][0];
      expect(arg.where.OR).toEqual([
        { senderId: 1, receiverId: 2 },
        { senderId: 2, receiverId: 1 },
      ]);
    });

    it('передає курсор для пагінації', async () => {
      await service.getConversation(1, 2, 100);
      const arg = prisma.chatMessage.findMany.mock.calls[0][0];
      expect(arg.where.id).toEqual({ lt: 100 });
    });
  });

  describe('getConversations', () => {
    it('групує за співрозмовником з непрочитаними', async () => {
      prisma.chatMessage.findMany.mockResolvedValue([
        { id: 3, senderId: 2, receiverId: 1, content: 'останнє' },
        { id: 2, senderId: 1, receiverId: 2, content: 'старіше' },
        { id: 1, senderId: 3, receiverId: 1, content: 'від іншого' },
      ]);
      prisma.chatMessage.groupBy.mockResolvedValue([
        { senderId: 2, _count: { _all: 4 } },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 2, firstName: 'A', lastName: 'B', avatar: '' },
        { id: 3, firstName: 'C', lastName: 'D', avatar: '' },
      ]);

      const res = await service.getConversations(1);
      expect(res).toHaveLength(2);
      expect(res[0].partner.id).toBe(2);
      expect(res[0].lastMessage.id).toBe(3);
      expect(res[0].unreadCount).toBe(4);
      expect(res[1].unreadCount).toBe(0);
    });
  });

  describe('markConversationRead', () => {
    it('позначає прочитаним і сповіщає співрозмовника', async () => {
      prisma.chatMessage.updateMany.mockResolvedValue({ count: 3 });
      const res = await service.markConversationRead(1, 2);
      expect(res).toEqual({ updated: 3 });
      expect(events.emitToUser).toHaveBeenCalledWith(2, 'chat:read', {
        readerId: 1,
      });
    });

    it('не сповіщає, якщо нічого не оновлено', async () => {
      await service.markConversationRead(1, 2);
      expect(events.emitToUser).not.toHaveBeenCalled();
    });
  });
});
