import { rotateSingleUseToken } from './redis-token.util';

describe('rotateSingleUseToken', () => {
  it('видає токен, видаляє попередній і ставить обидва ключі', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue('old'),
      del: jest.fn(),
      set: jest.fn(),
    };
    const token = await rotateSingleUseToken(redis, 'p:', 7, 100);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(redis.del).toHaveBeenCalledWith('p:old');
    expect(redis.set).toHaveBeenCalledWith(`p:${token}`, 7, 'EX', 100);
    expect(redis.set).toHaveBeenCalledWith('p:user:7', token, 'EX', 100);
  });

  it('без попереднього токена — нічого не видаляє', async () => {
    const redis: any = {
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn(),
      set: jest.fn(),
    };
    await rotateSingleUseToken(redis, 'p:', 7, 100);
    expect(redis.del).not.toHaveBeenCalled();
  });
});
