import {
  Update,
  Ctx,
  Start,
  Hears,
  Help,
  Action,
  Command,
  On,
} from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import { endOfDay, format, startOfDay } from 'date-fns';
import { fullName } from '../common/utils/full-name';
import {
  DepartmentLinkService,
  DEP_LINK_PATTERN,
  DEP_LINK_TTL_SEC,
} from './department-link.service';
import {
  ShiftSessionService,
  StartShiftResult,
  ShiftStartCheck,
} from '../work.shift/shift.session.service';

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
// Очікування коду підтвердження виходу на зміну (userId → JSON)
const SHIFT_VERIFY_KEY = 'shift-verify:';
const SHIFT_VERIFY_TTL_SEC = 300; // 5 хвилин
const SHIFT_VERIFY_MAX_ATTEMPTS = 5;

interface ShiftVerification {
  code: string;
  departmentId: number;
  departmentName: string;
  /** ISO-час натискання кнопки — саме він стає часом початку зміни */
  pressedAt: string;
  attempts: number;
  /** Геопозиція, надіслана до введення коду (якщо ділився) */
  coords?: { latitude: number; longitude: number };
}

const VERIFY_MINUTES = Math.round(SHIFT_VERIFY_TTL_SEC / 60);

@Update()
@Injectable()
export class TelegramUpdate {
  private readonly logger = new Logger('TelegramBot');

  constructor(
    private readonly prismaService: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly shiftSessionService: ShiftSessionService,
    private readonly departmentLinkService: DepartmentLinkService,
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

  // ---------- Початок зміни (з верифікацією присутності) ----------

  @Hears(BTN.start)
  async onStartShift(@Ctx() ctx: Context) {
    const user = await this.requireUser(ctx);
    if (!user) return;

    const pending = await this.getVerification(user.id);
    if (pending) {
      await ctx.reply(
        `⏳ Код підтвердження вже надіслано на акаунт відділення ` +
          `«${pending.departmentName}». Введіть його тут або скасуйте запит.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати запит', 'verify:cancel')],
        ]),
      );
      return;
    }

    const check = await this.shiftSessionService.checkShiftStart(user.id);
    if (check.status === 'NO_SCHEDULE') {
      const buttons = check.departments.map((d) => [
        Markup.button.callback(
          check.departments.length > 1 ? `🏢 ${d.name}` : '✅ Так, почати зміну',
          `offshift:${d.id}`,
        ),
      ]);
      buttons.push([Markup.button.callback('❌ Скасувати', 'offshift:cancel')]);

      await ctx.reply(
        'ℹ️ На сьогодні у вас немає запланованої зміни в графіку.\n' +
          'Можете почати зміну поза графіком — її буде позначено тегом ' +
          '«Поза графіком».' +
          (check.departments.length > 1 ? '\n\nОберіть відділення:' : ''),
        Markup.inlineKeyboard(buttons),
      );
      return;
    }
    if (check.status !== 'OK') {
      await this.replyStartShiftResult(ctx, check);
      return;
    }
    await this.beginVerification(ctx, user, check);
  }

  @Action(/^offshift:(\d+)$/)
  async onOffScheduleConfirm(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const user = await this.findUser(ctx);
    if (!user) return;

    // Прибираємо кнопки, щоб не натиснули двічі
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    const departmentId = Number((ctx as any).match[1]);
    const check = await this.shiftSessionService.checkShiftStart(
      user.id,
      departmentId,
    );
    if (check.status === 'NO_SCHEDULE' || check.status === 'NO_DEPARTMENT') {
      await ctx.reply(
        '❌ Не вдалося почати зміну: відділення недоступне. Спробуйте ще раз.',
        menuIdle,
      );
      return;
    }
    if (check.status !== 'OK') {
      await this.replyStartShiftResult(ctx, check);
      return;
    }
    await this.beginVerification(ctx, user, check);
  }

  @Action('offshift:cancel')
  async onOffScheduleCancel(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await ctx.reply('👌 Добре, зміну не розпочато.', menuIdle);
  }

  /**
   * Надсилає код підтвердження на Telegram-акаунт відділення.
   * Час початку зміни фіксується цим моментом (натискання кнопки).
   */
  private async beginVerification(
    ctx: Context,
    user: { id: number; firstName: string; lastName: string },
    check: Extract<ShiftStartCheck, { status: 'OK' }>,
  ) {
    if (!check.departmentTelegramId) {
      await ctx.reply(
        `❌ Відділення «${check.departmentName}» не підключено до Telegram, ` +
          'тому підтвердити присутність неможливо. Зверніться до адміністратора.',
        menuIdle,
      );
      return;
    }

    const pressedAt = new Date();
    // CSPRNG замість Math.random (код підтверджує фізичну присутність)
    const code = String(randomInt(1000, 10000));
    const verification: ShiftVerification = {
      code,
      departmentId: check.departmentId,
      departmentName: check.departmentName,
      pressedAt: pressedAt.toISOString(),
      attempts: 0,
    };

    try {
      await ctx.telegram.sendMessage(
        check.departmentTelegramId,
        `🔐 <b>${fullName(user)}</b> виходить на зміну.\n` +
          `Код підтвердження: <code>${code}</code>\n` +
          `Дійсний ${VERIFY_MINUTES} хв.`,
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.error(
        `Не вдалося надіслати код відділенню ${check.departmentId}: ${error.message}`,
      );
      await ctx.reply(
        `❌ Не вдалося надіслати код на акаунт відділення ` +
          `«${check.departmentName}». Зверніться до адміністратора.`,
        menuIdle,
      );
      return;
    }

    await this.redisClient.set(
      `${SHIFT_VERIFY_KEY}${user.id}`,
      JSON.stringify(verification),
      'EX',
      SHIFT_VERIFY_TTL_SEC,
    );

    // Геоперевірка вмикається на рівні відділення; якщо вона є — просимо
    // поділитися позицією. Відмова не блокує старт, лише лишає зміну
    // без підтвердження місця (GPS у приміщенні часто бреше).
    const geo = await this.prismaService.department.findUnique({
      where: { id: check.departmentId },
      select: { geofenceRadiusM: true, latitude: true, longitude: true },
    });
    const geofenceOn =
      !!geo?.geofenceRadiusM &&
      geo.geofenceRadiusM > 0 &&
      geo.latitude != null &&
      geo.longitude != null;

    if (geofenceOn) {
      await ctx.reply(
        '📍 Це відділення перевіряє місце відкриття зміни. ' +
          'Надішліть геолокацію — це не обовʼязково, але без неї зміна ' +
          'лишиться без підтвердження місця.',
        Markup.keyboard([
          [Markup.button.locationRequest('📍 Надіслати геолокацію')],
        ])
          .resize()
          .oneTime(),
      );
    }

    await ctx.replyWithHTML(
      `📲 На акаунт відділення «${check.departmentName}» надіслано ` +
        '4-значний код підтвердження.\n\n' +
        `Введіть його тут протягом <b>${VERIFY_MINUTES} хв</b>.\n` +
        `🕓 Час початку зміни зафіксовано: <b>${format(pressedAt, 'HH:mm')}</b>` +
        (check.offSchedule
          ? '\n📌 Зміну буде позначено тегом «Поза графіком».'
          : ''),
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'verify:cancel')],
      ]),
    );
  }

  @Hears(/^\d{4}$/)
  async onVerifyCode(@Ctx() ctx: Context) {
    const user = await this.requireUser(ctx);
    if (!user) return;

    const key = `${SHIFT_VERIFY_KEY}${user.id}`;
    const verification = await this.getVerification(user.id);
    if (!verification) {
      await ctx.reply(
        'ℹ️ Немає активного запиту на підтвердження. ' +
          `Натисніть «${BTN.start}», щоб почати зміну.`,
        menuIdle,
      );
      return;
    }

    const entered = (ctx.message as any).text;
    if (entered !== verification.code) {
      verification.attempts += 1;
      if (verification.attempts >= SHIFT_VERIFY_MAX_ATTEMPTS) {
        await this.redisClient.del(key);
        await ctx.reply(
          '❌ Забагато невдалих спроб. Запит скасовано — почніть зміну заново.',
          menuIdle,
        );
        return;
      }
      await this.redisClient.set(
        key,
        JSON.stringify(verification),
        'KEEPTTL',
      );
      await ctx.reply(
        `❌ Невірний код. Залишилось спроб: ${
          SHIFT_VERIFY_MAX_ATTEMPTS - verification.attempts
        }.`,
      );
      return;
    }

    await this.redisClient.del(key);
    const r = await this.shiftSessionService.startShift(
      user.id,
      verification.departmentId,
      new Date(verification.pressedAt),
      verification.coords ?? null,
    );
    await this.replyStartShiftResult(ctx, r);
  }

  /**
   * Геопозиція під час очікування коду. Прив'язуємо її до запиту, який уже
   * триває: окремої «сесії геолокації» немає, і надіслана поза потоком
   * позиція нічого не робить.
   */
  @On('location')
  async onLocation(@Ctx() ctx: Context) {
    const user = await this.findUser(ctx);
    if (!user) return;

    const verification = await this.getVerification(user.id);
    if (!verification) {
      await ctx.reply(
        'ℹ️ Зараз немає активного запиту на початок зміни, ' +
          'тож геолокація не потрібна.',
        menuIdle,
      );
      return;
    }

    const location = (ctx.message as any).location;
    verification.coords = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    await this.redisClient.set(
      `${SHIFT_VERIFY_KEY}${user.id}`,
      JSON.stringify(verification),
      'KEEPTTL',
    );

    await ctx.reply(
      '📍 Геопозицію отримано. Тепер введіть код підтвердження.',
      Markup.removeKeyboard(),
    );
  }

  @Action('verify:cancel')
  async onVerifyCancel(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    const user = await this.findUser(ctx);
    if (user) await this.redisClient.del(`${SHIFT_VERIFY_KEY}${user.id}`);
    await ctx.reply('👌 Запит скасовано, зміну не розпочато.', menuIdle);
  }

  private async getVerification(
    userId: number,
  ): Promise<ShiftVerification | null> {
    const raw = await this.redisClient.get(`${SHIFT_VERIFY_KEY}${userId}`);
    return raw ? (JSON.parse(raw) as ShiftVerification) : null;
  }

  /** Відповідь на результат перевірки/створення зміни. */
  private async replyStartShiftResult(
    ctx: Context,
    r: StartShiftResult | ShiftStartCheck,
  ) {
    switch (r.status) {
      case 'ALREADY_ACTIVE':
        await ctx.reply(
          `⚠️ У вас уже є активна зміна (розпочата о ${r.startedAt}).`,
          menuActive,
        );
        return;
      case 'NO_DEPARTMENT':
        await ctx.reply(
          '❌ Вас не прикріплено до жодного відділення. ' +
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
        ];
        if (r.offSchedule) {
          lines.push('📌 Зміна поза графіком — додано тег «Поза графіком».');
        } else {
          lines.push(`🕘 За графіком: ${r.scheduledStart}–${r.scheduledEnd}`);
          if (r.late) {
            lines.push(`⏰ Ви запізнилися (за графіком ${r.scheduledStart}).`);
          }
        }
        lines.push('\nГарного робочого дня! 💪');
        await ctx.replyWithHTML(lines.join('\n'), menuActive);
        return;
      }
    }
  }

  // ---------- Завершення зміни ----------

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

  // ---------- Прив'язка Telegram-акаунта відділення (для адмінів) ----------

  @Command('departments')
  async onDepartmentsCommand(@Ctx() ctx: Context) {
    const admin = await this.requireAdmin(ctx);
    if (!admin) return;

    const departments = await this.prismaService.department.findMany({
      select: { id: true, name: true, telegramId: true },
      orderBy: { name: 'asc' },
    });
    if (!departments.length) {
      await ctx.reply('ℹ️ Відділень ще не створено.');
      return;
    }

    await ctx.reply(
      '🏢 Оберіть відділення, щоб згенерувати код прив’язки його ' +
        'Telegram-акаунта (куди надходитимуть коди підтвердження змін):',
      Markup.inlineKeyboard(
        departments.map((d) => [
          Markup.button.callback(
            `${d.telegramId ? '🔗' : '⚪'} ${d.name}`,
            `depbind:${d.id}`,
          ),
        ]),
      ),
    );
  }

  @Action(/^depbind:(\d+)$/)
  async onDepartmentBind(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const admin = await this.requireAdmin(ctx);
    if (!admin) return;

    const departmentId = Number((ctx as any).match[1]);
    const department = await this.prismaService.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });
    if (!department) {
      await ctx.reply('❌ Відділення не знайдено.');
      return;
    }

    const { code, expiresInSec } = await this.departmentLinkService.createCode(
      department.id,
    );

    await ctx.replyWithHTML(
      `🔑 Код прив’язки для відділення «${department.name}»:\n\n` +
        `<code>${code}</code>\n\n` +
        'Надішліть його цьому боту <b>з Telegram-акаунта відділення</b> ' +
        `протягом ${Math.round(expiresInSec / 60)} хв.`,
    );
  }

  @Hears(DEP_LINK_PATTERN)
  async onDepartmentLinkCode(@Ctx() ctx: Context) {
    const code = (ctx.message as any).text.toUpperCase();
    const chatId = ctx.chat.id.toString();

    const department = await this.departmentLinkService.consumeCode(
      code,
      chatId,
    );
    if (!department) {
      await ctx.reply(
        `❌ Код прив’язки недійсний або його час дії ` +
          `(${Math.round(DEP_LINK_TTL_SEC / 60)} хв) минув.`,
      );
      return;
    }

    await ctx.reply(
      `✅ Цей чат підключено як акаунт відділення «${department.name}».\n` +
        'Сюди надходитимуть коди підтвердження виходу на зміну.',
    );
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
        `${BTN.start} — почати робочу зміну. На акаунт відділення прийде ` +
        '4-значний код — введіть його протягом 10 хвилин, щоб підтвердити ' +
        'присутність. Час початку зміни фіксується моментом натискання кнопки. ' +
        'Якщо графіка на сьогодні немає, можна почати поза графіком ' +
        '(з тегом «Поза графіком»).\n' +
        `${BTN.end} — завершити активну зміну.\n` +
        `${BTN.status} — поточний стан і графік на сьогодні.\n\n` +
        'Підключити акаунт: код із «Налаштувань» на сайті.\n' +
        'Для адміністраторів: /departments — прив’язати Telegram-акаунт ' +
        'відділення.',
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

  /** Пускає далі лише адміністраторів. */
  private async requireAdmin(ctx: Context) {
    const user = await this.requireUser(ctx);
    if (!user) return null;
    if (user.role !== 'Admin') {
      await ctx.reply('❌ Ця команда доступна лише адміністраторам.');
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
