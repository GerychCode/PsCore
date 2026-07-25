import { randomBytes } from 'crypto';
import { Redis } from 'ioredis';

/**
 * Видає одноразовий токен і робить попередній (для того ж користувача й
 * префікса) недійсним — щоб водночас жив лише один активний лінк.
 * Спільне для запрошень, верифікації пошти й скидання пароля.
 *
 * Ключі: `${prefix}${token}` = userId (сам токен), `${prefix}user:${userId}`
 * = поточний токен (вказівник для інвалідації попереднього).
 */
export async function rotateSingleUseToken(
  redis: Redis,
  prefix: string,
  userId: number,
  ttl: number,
): Promise<string> {
  const pointerKey = `${prefix}user:${userId}`;
  const previous = await redis.get(pointerKey);
  if (previous) {
    await redis.del(`${prefix}${previous}`);
  }
  const token = randomBytes(32).toString('hex');
  await redis.set(`${prefix}${token}`, userId, 'EX', ttl);
  await redis.set(pointerKey, token, 'EX', ttl);
  return token;
}
