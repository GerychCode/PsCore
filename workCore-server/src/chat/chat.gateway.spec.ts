import { ChatGateway } from './chat.gateway';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: any;
  let redis: any;

  const client = (userId?: number): any => ({ data: { userId } });

  beforeEach(() => {
    chatService = {
      sendMessage: jest.fn().mockResolvedValue({ id: 1 }),
      markConversationRead: jest.fn().mockResolvedValue({ updated: 1 }),
    };
    redis = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    gateway = new ChatGateway(chatService, redis);
  });

  describe('onSendMessage', () => {
    it('без авторизації → error', async () => {
      const res = await gateway.onSendMessage(client(undefined), {} as any);
      expect(res).toEqual({ error: expect.any(String) });
    });

    it('успіх → повертає message і ставить expire на першому запиті', async () => {
      const res = await gateway.onSendMessage(client(1), {
        receiverId: 2,
        content: 'hi',
      });
      expect(redis.expire).toHaveBeenCalled();
      expect(chatService.sendMessage).toHaveBeenCalledWith(1, 2, 'hi');
      expect(res).toEqual({ message: { id: 1 } });
    });

    it('перевищення ліміту → error, повідомлення не шлеться', async () => {
      redis.incr.mockResolvedValue(21); // > CHAT_RATE_LIMIT
      const res = await gateway.onSendMessage(client(1), {
        receiverId: 2,
        content: 'spam',
      });
      expect(res).toEqual({ error: expect.any(String) });
      expect(chatService.sendMessage).not.toHaveBeenCalled();
    });

    it('помилка сервісу → { error }', async () => {
      chatService.sendMessage.mockRejectedValue(new Error('нема отримувача'));
      const res = await gateway.onSendMessage(client(1), {
        receiverId: 2,
        content: 'hi',
      });
      expect(res).toEqual({ error: 'нема отримувача' });
    });
  });

  describe('onMarkRead', () => {
    it('без авторизації → error', async () => {
      const res = await gateway.onMarkRead(client(undefined), {
        partnerId: 2,
      });
      expect(res).toEqual({ error: expect.any(String) });
    });

    it('невірний partnerId → error', async () => {
      const res = await gateway.onMarkRead(client(1), { partnerId: 0 });
      expect(res).toEqual({ error: expect.any(String) });
    });

    it('валідно → делегує в сервіс', async () => {
      const res = await gateway.onMarkRead(client(1), { partnerId: 2 });
      expect(chatService.markConversationRead).toHaveBeenCalledWith(1, 2);
      expect(res).toEqual({ updated: 1 });
    });
  });
});
