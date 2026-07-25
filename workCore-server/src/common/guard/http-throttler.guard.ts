import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Тротлінг лише для HTTP-запитів.
 * Глобальний guard спрацьовує і на не-HTTP контекстах (Telegraf, WebSocket),
 * де немає Express res — базовий ThrottlerGuard там падає з
 * "res.header is not a function".
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<string>() !== 'http') {
      return true;
    }
    return super.canActivate(context);
  }
}
