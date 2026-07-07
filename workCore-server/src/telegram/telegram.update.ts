import { Update, Ctx, Start, Hears, Help } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import { endOfDay, startOfDay } from 'date-fns';
import { ShiftSessionService } from '../work.shift/shift.session.service';

// --- Кнопки та меню ---
const BTN = {
  start: '🟢 Почати зміну',
  end: '🔴 Закінчити зміну',
  status: '📊 Статус',
  help: 'ℹ️ Довідка',
};

const menuIdle = Markup.keyboard([
  [BTN.start],
  [BTN.status, BTN.help],
]).resize();

const menuActive = Markup.keyboard([
  [BTN.end],
  [BTN.status, BTN.help],
]).resize();

const AUTH_CODE_TTL = 'telegram-code:';

@Update()
@Injectable()
export class TelegramUpdate {
  private readonly logger = new Logger('TelegramBot');

  constructor(
    private readonly prismaService: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly shiftSessionService: ShiftSessionService,
  ) {}

  // ---------- Авторизація ----------

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const code = ((ctx.message as any)?.text ?? '').split(' ')[1];
    if (code) {
      await this.processAuthCode(ctx, code);
      return;
    }

    const user = await this.findUser(ctx);
    if (user) {
      await ctx.reply(
        `👋 Вітаю, ${user.firstName}! Ваш акаунт уже підключено.`,
        await this.menuFor(user.id),
      );
      return;
    }

    await ctx.reply(
      '👋 Привіт! Це бот WorkCore для обліку робочих змін.\n\n' +
        'Щоб підключити акаунт, згенеруйте 6-значний код у розділі ' +
        '«Налаштування» на сайті та надішліть його сюди повідомленням.',
    );
  }

  @Hears(/^\d{6}$/)
  async onCodeText(@Ctx() ctx: Context) {
    await this.processAuthCode(ctx, (ctx.message as any).text);
  }

  private async processAuthCode(ctx: Context, code: string) {
    const userIdStr = await this.redisClient.get(`${AUTH_CODE_TTL}${code}`);
    if (!userIdStr) {
      await ctx.reply(
        '❌ Код недійсний або його час дії (5 хвилин) минув. ' +
          'Згенеруйте новий на сайті.',
      );
      return;
    }

    const userId = parseInt(userIdStr, 10);
    await this.prismaService.user.update({
      where: { id: userId },
      data: { telegramId: ctx.from.id.toString() },
    });
    await this.redisClient.del(`${AUTH_CODE_TTL}${code}`);
    this.logger.log(`Акаунт ${userId} підключено до Telegram ${ctx.from.id}`);

    await ctx.reply(
      '✅ Акаунт успішно підключено!\n\n' +
        'Тепер можете керувати змінами прямо звідси. ' +
        'Натисніть «📊 Статус», щоб побачити поточний стан.',
      await this.menuFor(userId),
    );
  }

  // ---------- Зміни ----------

  @Hears(BTN.start)
  async onStartShift(@Ctx() ctx: Context) {
    const user = await this.requireUser(ctx);
    if (!user) return;

    const r = await this.shiftSessionService.startShift(user.id);
    switch (r.status) {
      case 'ALREADY_ACTIVE':
        await ctx.reply(
          `⚠️ У вас уже є активна зміна (розпочата о ${r.startedAt}).`,
          menuActive,
        );
        return;
      case 'NO_SCHEDULE':
        await ctx.reply(
          '❌ На сьогодні у вас немає запланованої зміни в графіку. ' +
            'Зверніться до адміністратора.',
          menuIdle,
        );
        return;
      case 'OVERLAP':
        await ctx.reply(
          '⚠️ Поточний час перетинається з уже зареєстрованою зміною на сьогодні.',
          menuIdle,
        );
        return;
      case 'STARTED': {
        const lines = [
          `✅ Зміну розпочато о <b>${r.time}</b>`,
          `🏢 Відділення: <b>${r.departmentName}</b>`,
          `🕘 За графіком: ${r.scheduledStart}–${r.scheduledEnd}`,
        ];
        if (r.late) {
          lines.push(`⏰ Ви запізнилися (за графіком ${r.scheduledStart}).`);
        }
        lines.push('\nГарного робочого дня! 💪');
        await ctx.replyWithHTML(lines.join('\n'), menuActive);
        return;
      }
    }
  }

  @Hears(BTN.end)
  async onEndShift(@Ctx() ctx: Context) {
    const user = await this.requireUser(ctx);
    if (!user) return;

    const r = await this.shiftSessionService.endShift(user.id);
    if (r.status === 'NO_ACTIVE') {
      await ctx.reply('⚠️ У вас немає активних змін для завершення.', menuIdle);
      return;
    }

    const overtime = r.totalHours > 8 ? r.totalHours - 8 : 0;
    const lines = [
      `🔴 Зміну завершено о <b>${r.time}</b>`,
      `⏱ Відпрацьовано: <b>${r.totalHours} год</b> (з ${r.startedAt})`,
    ];
    if (overtime > 0) {
      lines.push(`🔥 Понаднормово: ${overtime.toFixed(2)} год`);
    }
    lines.push('\nЗміну відправлено на підтвердження адміністратору.');
    await ctx.replyWithHTML(lines.join('\n'), menuIdle);
  }

  // ---------- Статус і довідка ----------

  @Hears(BTN.status)
  async onStatus(@Ctx() ctx: Context) {
    const user = await this.requireUser(ctx);
    if (!user) return;

    const now = new Date();
    const active = await this.prismaService.workShift.findFirst({
      where: { userId: user.id, endTime: '' },
      include: { department: { select: { name: true } } },
    });

    if (active) {
      await ctx.replyWithHTML(
        `📊 <b>Активна зміна</b>\n` +
          `🏢 ${(active as any).department?.name ?? '—'}\n` +
          `🟢 Початок: ${active.startedAt}`,
        menuActive,
      );
      return;
    }

    const schedule = await this.prismaService.workSchedule.findFirst({
      where: {
        userId: user.id,
        date: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      include: { department: { select: { name: true } } },
    });

    if (!schedule) {
      await ctx.reply(
        '📊 Активних змін немає. На сьогодні графік не заплановано.',
        menuIdle,
      );
      return;
    }

    if (schedule.isDayOff) {
      await ctx.reply('📊 Сьогодні у вас вихідний за графіком. 🌙', menuIdle);
      return;
    }

    await ctx.replyWithHTML(
      `📊 <b>Активних змін немає</b>\n` +
        `За графіком сьогодні: ${schedule.startedAt}–${schedule.endTime} ` +
        `(${(schedule as any).department?.name ?? '—'})`,
      menuIdle,
    );
  }

  @Hears(BTN.help)
  @Help()
  async onHelp(@Ctx() ctx: Context) {
    await ctx.replyWithHTML(
      '<b>ℹ️ Довідка WorkCore</b>\n\n' +
        `${BTN.start} — почати робочу зміну (за наявності графіка).\n` +
        `${BTN.end} — завершити активну зміну.\n` +
        `${BTN.status} — поточний стан і графік на сьогодні.\n\n` +
        'Підключити акаунт: код із «Налаштувань» на сайті.',
    );
  }

  // ---------- Допоміжне ----------

  private findUser(ctx: Context) {
    return this.prismaService.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });
  }

  /** Знаходить користувача або відповідає підказкою і повертає null. */
  private async requireUser(ctx: Context) {
    const user = await this.findUser(ctx);
    if (!user) {
      await ctx.reply(
        '❌ Ваш акаунт не підключено. Надішліть код із «Налаштувань» на сайті.',
      );
      return null;
    }
    return user;
  }

  /** Меню залежно від того, чи є активна зміна. */
  private async menuFor(userId: number) {
    const active = await this.prismaService.workShift.findFirst({
      where: { userId, endTime: '' },
      select: { id: true },
    });
    return active ? menuActive : menuIdle;
  }
}
