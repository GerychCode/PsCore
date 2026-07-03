import { EventsGateway } from './events.gateway';
import { createHmac } from 'crypto';

// Аналог cookie-signature.sign — так express-session підписує session id
const sign = (value: string, secret: string) =>
  `${value}.${createHmac('sha256', secret)
    .update(value)
    .digest('base64')
    .replace(/=+$/, '')}`;

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let emit: jest.Mock;
  let to: jest.Mock;
  let redis: { get: jest.Mock };
  let config: { getOrThrow: jest.Mock };

  const SECRET = 'test-secret';
  const SESSION_NAME = 'session';
  const SESSION_FOLDER = 'session:';

  const signedSessionCookie = (sid: string) =>
    encodeURIComponent(`s:${sign(sid, SECRET)}`);

  const client = (id: string, cookie?: string) =>
    ({
      id,
      data: {},
      handshake: { headers: { cookie } },
      disconnect: jest.fn(),
    }) as any;

  const authedClient = (id: string) =>
    client(id, `${SESSION_NAME}=${signedSessionCookie('sid-1')}`);

  beforeEach(() => {
    redis = { get: jest.fn() };
    config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'SESSION_NAME') return SESSION_NAME;
        if (key === 'SESSION_SECRET') return SECRET;
        if (key === 'SESSION_FOLDER') return SESSION_FOLDER;
        throw new Error(`unexpected key ${key}`);
      }),
    };
    gateway = new EventsGateway(config as any, redis as any);
    emit = jest.fn();
    to = jest.fn(() => ({ emit }));
    gateway.server = { to, emit } as any;
  });

  describe('handleConnection (автентифікація за сесією)', () => {
    it('реєструє сокет з валідною сесією', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 5 }));
      const c = authedClient('s1');
      await gateway.handleConnection(c);

      expect(redis.get).toHaveBeenCalledWith('session:sid-1');
      expect(c.data.userId).toBe(5);
      expect(c.disconnect).not.toHaveBeenCalled();
      expect(gateway.emitToUser(5, 'event')).toBe(true);
    });

    it('відхиляє сокет без кукі', async () => {
      const c = client('s1');
      await gateway.handleConnection(c);
      expect(c.disconnect).toHaveBeenCalled();
    });

    it('відхиляє кукі з невалідним підписом', async () => {
      const forged = encodeURIComponent('s:sid-1.forged-signature');
      const c = client('s1', `${SESSION_NAME}=${forged}`);
      await gateway.handleConnection(c);
      expect(c.disconnect).toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('відхиляє сокет, якщо сесії немає в Redis', async () => {
      redis.get.mockResolvedValue(null);
      const c = authedClient('s1');
      await gateway.handleConnection(c);
      expect(c.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('видаляє сокет користувача', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 5 }));
      const c = authedClient('s1');
      await gateway.handleConnection(c);
      gateway.handleDisconnect(c);
      expect(gateway.emitToUser(5, 'event')).toBe(false);
    });

    it('зберігає інші сокети користувача при відключенні одного', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 7 }));
      const c1 = authedClient('s1');
      const c2 = authedClient('s2');
      await gateway.handleConnection(c1);
      await gateway.handleConnection(c2);
      gateway.handleDisconnect(c1);
      expect(gateway.emitToUser(7, 'event')).toBe(true);
    });

    it('коректно обробляє відключення неавтентифікованого сокета', () => {
      gateway.handleDisconnect(client('sX'));
      expect(gateway.emitToUser(8, 'event')).toBe(false);
    });
  });

  describe('emitToUser', () => {
    it('повертає false, якщо у користувача немає сокетів', () => {
      expect(gateway.emitToUser(999, 'event', { a: 1 })).toBe(false);
    });

    it('надсилає подію в усі сокети користувача', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 5 }));
      await gateway.handleConnection(authedClient('s1'));
      gateway.emitToUser(5, 'event', { a: 1 });
      expect(to).toHaveBeenCalledWith('s1');
      expect(emit).toHaveBeenCalledWith('event', { a: 1 });
    });
  });

  describe('emitToUsers / emitToAll', () => {
    it('emitToUsers викликає emitToUser для кожного', () => {
      const spy = jest.spyOn(gateway, 'emitToUser');
      gateway.emitToUsers([1, 2], 'event', 'p');
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('emitToAll надсилає всім через server.emit', () => {
      gateway.emitToAll('event', 'p');
      expect(emit).toHaveBeenCalledWith('event', 'p');
    });
  });
});
