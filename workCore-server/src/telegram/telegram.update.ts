import { Update, Ctx, Start, Hears } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import { ShiftSessionService } from '../work.shift/shift.session.service';

@Update()
@Injectable()
export class TelegramUpdate {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly shiftSessionService: ShiftSessionService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const messageText = (ctx.message as any).text;
    const code = messageText.split(' ')[1];

    if (!code) {
      await ctx.reply(
        '👋 Привіт! Щоб авторизуватися, згенеруйте код у своєму профілі на сайті та введіть його прямо сюди повідомленням (наприклад: 123456).',
      );
      return;
    }

    await this.processAuthCode(ctx, code);
  }

  @Hears(/^\d{6}$/)
  async onCodeText(@Ctx() ctx: Context) {
    const code = (ctx.message as any).text;
    await this.processAuthCode(ctx, code);
  }

  private async processAuthCode(ctx: Context, code: string) {
    const userIdStr = await this.redisClient.get(`telegram-code:${code}`);

    if (!userIdStr) {
      await ctx.reply(
        '❌ Цей код недійсний або його час дії (5 хвилин) минув. Будь ласка, згенеруйте новий на сайті.',
      );
      return;
    }

    const userId = parseInt(userIdStr, 10);

    await this.prismaService.user.update({
      where: { id: userId },
      data: { telegramId: ctx.from.id.toString() },
    });

    await this.redisClient.del(`telegram-code:${code}`);

    await ctx.reply(
      '✅ Ваш акаунт успішно підключено!\n\nТепер ви можете керувати своїми робочими змінами прямо звідси.',
      Markup.keyboard([['🟢 Почати зміну']]).resize(),
    );
  }

  private findUserByTelegramId(ctx: Context) {
    return this.prismaService.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });
  }

  @Hears('🟢 Почати зміну')
  async onStartShift(@Ctx() ctx: Context) {
    const user = await this.findUserByTelegramId(ctx);

    if (!user) {
      await ctx.reply('❌ Ваш акаунт не знайдено. Авторизуйтесь через сайт.');
      return;
    }

    const result = await this.shiftSessionService.startShift(user.id);

    switch (result.status) {
      case 'ALREADY_ACTIVE':
        await ctx.reply(
          '⚠️ У вас вже є активна зміна!',
          Markup.keyboard([['🔴 Закінчити зміну']]).resize(),
        );
        return;
      case 'NO_SCHEDULE':
        await ctx.reply(
          '❌ У вас немає запланованої зміни на сьогодні у розкладі. Зверніться до адміністратора.',
        );
        return;
      case 'OVERLAP':
        await ctx.reply(
          '⚠️ Поточний час перетинається з уже зареєстрованою зміною на сьогодні.',
        );
        return;
      case 'STARTED':
        await ctx.reply(
          `✅ Зміну успішно розпочато о ${result.time}!\nБажаю гарного робочого дня.`,
          Markup.keyboard([['🔴 Закінчити зміну']]).resize(),
        );
        return;
    }
  }

  @Hears('🔴 Закінчити зміну')
  async onEndShift(@Ctx() ctx: Context) {
    const user = await this.findUserByTelegramId(ctx);

    if (!user) {
      await ctx.reply('❌ Ваш акаунт не знайдено.');
      return;
    }

    const result = await this.shiftSessionService.endShift(user.id);

    if (result.status === 'NO_ACTIVE') {
      await ctx.reply(
        '⚠️ У вас немає активних змін для завершення.',
        Markup.keyboard([['🟢 Почати зміну']]).resize(),
      );
      return;
    }

    await ctx.reply(
      `✅ Зміну успішно завершено о ${result.time}.\nВідпрацьовано годин: ${result.totalHours}`,
      Markup.keyboard([['🟢 Почати зміну']]).resize(),
    );
  }
}
