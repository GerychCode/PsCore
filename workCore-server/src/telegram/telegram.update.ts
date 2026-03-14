import { Update, Ctx, Start, Hears } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';

@Update()
@Injectable()
export class TelegramUpdate {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  // 1. Обробка команди /start (з кодом або без)
  @Start()
  async onStart(@Ctx() ctx: Context) {
    const messageText = (ctx.message as any).text;
    const code = messageText.split(' ')[1]; // Отримуємо код з /start 123456

    // Якщо користувач просто натиснув Start без коду
    if (!code) {
      await ctx.reply(
        '👋 Привіт! Щоб авторизуватися, згенеруйте код у своєму профілі на сайті та введіть його прямо сюди повідомленням (наприклад: 123456).',
      );
      return;
    }

    // Якщо код є в команді start, обробляємо його
    await this.processAuthCode(ctx, code);
  }

  // 2. Обробка простого тексту, якщо це 6 цифр (регулярний вираз)
  @Hears(/^\d{6}$/)
  async onCodeText(@Ctx() ctx: Context) {
    const code = (ctx.message as any).text;
    await this.processAuthCode(ctx, code);
  }

  // Спільна логіка перевірки коду, щоб не дублювати код
  private async processAuthCode(ctx: Context, code: string) {
    const userIdStr = await this.redisClient.get(`telegram-code:${code}`);

    if (!userIdStr) {
      await ctx.reply(
        '❌ Цей код недійсний або його час дії (5 хвилин) минув. Будь ласка, згенеруйте новий на сайті.',
      );
      return;
    }

    const userId = parseInt(userIdStr, 10);

    // Оновлюємо користувача в БД, зберігаючи його Telegram ID
    console.log(ctx.from.id);
    await this.prismaService.user.update({
      where: { id: userId },
      data: { telegramId: ctx.from.id.toString() },
    });

    // Видаляємо код з Redis
    await this.redisClient.del(`telegram-code:${code}`);

    await ctx.reply(
      '✅ Ваш акаунт успішно підключено!\n\nТепер ви можете керувати своїми робочими змінами прямо звідси.',
      Markup.keyboard([['🟢 Почати зміну']]).resize(),
    );
  }

  // 3. Обробка кнопки "Почати зміну"
  @Hears('🟢 Почати зміну')
  async onStartShift(@Ctx() ctx: Context) {
    const telegramId = ctx.from.id.toString();

    const user = await this.prismaService.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      await ctx.reply('❌ Ваш акаунт не знайдено. Авторизуйтесь через сайт.');
      return;
    }

    const activeShift = await this.prismaService.workShift.findFirst({
      where: {
        userId: user.id,
        endTime: '',
      },
    });

    if (activeShift) {
      await ctx.reply(
        '⚠️ У вас вже є активна зміна!',
        Markup.keyboard([['🔴 Закінчити зміну']]).resize(),
      );
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySchedule = await this.prismaService.workSchedule.findFirst({
      where: {
        userId: user.id,
        date: { gte: today },
      },
    });

    if (!todaySchedule) {
      await ctx.reply(
        '❌ У вас немає запланованої зміни на сьогодні у розкладі. Зверніться до адміністратора.',
      );
      return;
    }

    const now = new Date();
    const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    await this.prismaService.workShift.create({
      data: {
        userId: user.id,
        departmentId: todaySchedule.departmentId,
        date: now,
        startedAt: currentTimeString,
        endTime: '',
        totalHours: 0,
        status: 'PENDING',
      },
    });

    await ctx.reply(
      `✅ Зміну успішно розпочато о ${currentTimeString}!\nБажаю гарного робочого дня.`,
      Markup.keyboard([['🔴 Закінчити зміну']]).resize(),
    );
  }

  // 4. Обробка кнопки "Закінчити зміну"
  @Hears('🔴 Закінчити зміну')
  async onEndShift(@Ctx() ctx: Context) {
    const telegramId = ctx.from.id.toString();

    const user = await this.prismaService.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      await ctx.reply('❌ Ваш акаунт не знайдено.');
      return;
    }

    const activeShift = await this.prismaService.workShift.findFirst({
      where: {
        userId: user.id,
        endTime: '',
      },
    });

    if (!activeShift) {
      await ctx.reply(
        '⚠️ У вас немає активних змін для завершення.',
        Markup.keyboard([['🟢 Почати зміну']]).resize(),
      );
      return;
    }

    const now = new Date();
    const endTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const [startHour, startMin] = activeShift.startedAt.split(':').map(Number);
    const totalMinutes =
      now.getHours() * 60 + now.getMinutes() - (startHour * 60 + startMin);
    const totalHours = Number((totalMinutes / 60).toFixed(2));

    await this.prismaService.workShift.update({
      where: { id: activeShift.id },
      data: {
        endTime: endTimeString,
        totalHours: totalHours > 0 ? totalHours : 0,
      },
    });

    await ctx.reply(
      `✅ Зміну успішно завершено о ${endTimeString}.\nВідпрацьовано годин: ${totalHours > 0 ? totalHours : 0}`,
      Markup.keyboard([['🟢 Почати зміну']]).resize(),
    );
  }
}
