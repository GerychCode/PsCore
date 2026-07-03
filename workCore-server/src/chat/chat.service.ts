import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_PAGE_SIZE = 50;

@Injectable()
export class ChatService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async sendMessage(senderId: number, receiverId: number, content: string) {
    if (!Number.isInteger(receiverId) || receiverId <= 0) {
      throw new BadRequestException('Невірний отримувач!');
    }
    if (receiverId === senderId) {
      throw new BadRequestException('Не можна надіслати повідомлення собі!');
    }

    const trimmed = (content ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Повідомлення не може бути порожнім!');
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Повідомлення не може перевищувати ${MAX_MESSAGE_LENGTH} символів!`,
      );
    }

    const receiver = await this.prismaService.user.findUnique({
      where: { id: receiverId },
      select: { id: true },
    });
    if (!receiver) throw new NotFoundException('Отримувача не знайдено!');

    const message = await this.prismaService.chatMessage.create({
      data: {
        senderId,
        receiverId,
        content: trimmed,
      },
    });

    // Отримувачу — нове повідомлення; відправнику — синхронізація інших вкладок
    this.eventsGateway.emitToUser(receiverId, 'chat:message', message);
    this.eventsGateway.emitToUser(senderId, 'chat:message', message);

    return message;
  }

  async getConversation(userId: number, partnerId: number, cursor?: number) {
    const messages = await this.prismaService.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
        ...(cursor && { id: { lt: cursor } }),
      },
      orderBy: { id: 'desc' },
      take: HISTORY_PAGE_SIZE,
    });

    return {
      // Віддаємо у хронологічному порядку — зручніше рендерити
      messages: messages.reverse(),
      hasMore: messages.length === HISTORY_PAGE_SIZE,
    };
  }

  /**
   * Список діалогів: співрозмовник, останнє повідомлення, кількість непрочитаних.
   * Команда невелика, тому редукція останніх повідомлень у памʼяті — свідомий компроміс.
   */
  async getConversations(userId: number) {
    const recentMessages = await this.prismaService.chatMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { id: 'desc' },
      take: 500,
    });

    const lastMessageByPartner = new Map<
      number,
      (typeof recentMessages)[number]
    >();
    for (const message of recentMessages) {
      const partnerId =
        message.senderId === userId ? message.receiverId : message.senderId;
      if (!lastMessageByPartner.has(partnerId)) {
        lastMessageByPartner.set(partnerId, message);
      }
    }

    const unreadGroups = await this.prismaService.chatMessage.groupBy({
      by: ['senderId'],
      where: { receiverId: userId, isRead: false },
      _count: { _all: true },
    });
    const unreadBySender = new Map(
      unreadGroups.map((group) => [group.senderId, group._count._all]),
    );

    const partnerIds = Array.from(lastMessageByPartner.keys());
    const partners = await this.prismaService.user.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, firstName: true, lastName: true, avatar: true },
    });
    const partnerById = new Map(partners.map((p) => [p.id, p]));

    return partnerIds
      .map((partnerId) => ({
        partner: partnerById.get(partnerId),
        lastMessage: lastMessageByPartner.get(partnerId),
        unreadCount: unreadBySender.get(partnerId) ?? 0,
      }))
      .filter((conversation) => conversation.partner);
  }

  async markConversationRead(userId: number, partnerId: number) {
    const result = await this.prismaService.chatMessage.updateMany({
      where: {
        senderId: partnerId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    if (result.count > 0) {
      // Співрозмовник бачить, що його повідомлення прочитані
      this.eventsGateway.emitToUser(partnerId, 'chat:read', {
        readerId: userId,
      });
    }

    return { updated: result.count };
  }

  async getUnreadCount(userId: number) {
    const count = await this.prismaService.chatMessage.count({
      where: { receiverId: userId, isRead: false },
    });
    return { count };
  }
}
