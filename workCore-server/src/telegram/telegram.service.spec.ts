import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  let service: TelegramService;
  let bot: { telegram: { sendMessage: jest.Mock } };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    bot = { telegram: { sendMessage: jest.fn() } };
    service = new TelegramService(bot as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('повертає true при успішній відправці', async () => {
    bot.telegram.sendMessage.mockResolvedValue(undefined);

    const res = await service.sendMessage('123', 'Привіт');

    expect(res).toBe(true);
    expect(bot.telegram.sendMessage).toHaveBeenCalledWith('123', 'Привіт', {
      parse_mode: 'HTML',
    });
  });

  it('повертає false і логує помилку при невдачі', async () => {
    bot.telegram.sendMessage.mockRejectedValue(new Error('fail'));

    const res = await service.sendMessage('123', 'Привіт');

    expect(res).toBe(false);
  });
});
