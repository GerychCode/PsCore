import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(@InjectBot() private readonly bot: Telegraf) {}

  async sendMessage(telegramId: string, message: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendMessage(telegramId, message, {
        parse_mode: 'HTML',
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Помилка відправки в Telegram для ID ${telegramId}: ${error.message}`,
      );
      return false;
    }
  }
}
