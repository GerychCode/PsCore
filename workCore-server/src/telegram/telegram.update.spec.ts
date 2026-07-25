import { TelegramUpdate } from './telegram.update';
import { ShiftSessionService } from '../work.shift/shift.session.service';

describe('TelegramUpdate', () => {
  let update: TelegramUpdate;
  let prisma: any;
  let redis: { get: jest.Mock; del: jest.Mock; set: jest.Mock };
  let departmentLink: { createCode: jest.Mock; consumeCode: jest.Mock };
  let events: { emitToUsers: jest.Mock };

  const ctx = (text?: string) => ({
    message: { text },
    from: { id: 123 },
    chat: { id: 123 },
    reply: jest.fn().mockResolvedValue(undefined),
    replyWithHTML: jest.fn().mockResolvedValue(undefined),
    answerCbQuery: jest.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
    telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) },
  });

  beforeEach(() => {
    prisma = {
      user: { update: jest.fn(), findUnique: jest.fn() },
      workShift: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        // startShift читає created.id для рушія правил
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn(),
      },
      workSchedule: { findFirst: jest.fn() },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      tag: {
        upsert: jest.fn().mockResolvedValue({ id: 99 }),
      },
      // startShift тепер створює зміну в транзакції з advisory-lock
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
    } as any;
    events = { emitToUsers: jest.fn() };
    const userService = { getAdmins: jest.fn().mockResolvedValue([]) };
    const tagRuleEngine = { apply: jest.fn().mockResolvedValue([]) } as any;
    const shiftSession = new ShiftSessionService(
      prisma,
      userService as any,
      events as any,
      tagRuleEngine,
    );
    departmentLink = {
      createCode: jest
        .fn()
        .mockResolvedValue({ code: 'DEP-AB2CD', expiresInSec: 300 }),
      consumeCode: jest.fn().mockResolvedValue(null),
    };
    update = new TelegramUpdate(
      prisma,
      redis as any,
      shiftSession,
      departmentLink as any,
    );
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('onStart', () => {
    it('просить код, якщо команда без коду', async () => {
      const c = ctx('/start');
      await update.onStart(c as any);
      expect(c.reply).toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('обробляє код, якщо він переданий у /start', async () => {
      redis.get.mockResolvedValue(null);
      const c = ctx('/start 123456');
      await update.onStart(c as any);
      expect(redis.get).toHaveBeenCalledWith('telegram-code:123456');
    });
  });

  describe('onCodeText / processAuthCode', () => {
    it('повідомляє про недійсний код', async () => {
      redis.get.mockResolvedValue(null);
      const c = ctx('123456');
      await update.onCodeText(c as any);
      expect(c.reply).toHaveBeenCalledWith(expect.stringContaining('недійсний'));
    });

    it('привʼязує акаунт при дійсному коді', async () => {
      redis.get.mockResolvedValue('42');
      const c = ctx('123456');
      await update.onCodeText(c as any);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { telegramId: '123' },
      });
      expect(redis.del).toHaveBeenCalledWith('telegram-code:123456');
    });
  });

  describe('onStartShift', () => {
    it('повідомляє, якщо акаунт не підключено', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const c = ctx();
      await update.onStartShift(c as any);
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('не підключено'),
      );
    });

    it('повідомляє про вже активну зміну', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findFirst.mockResolvedValue({ id: 9, startedAt: '09:00' });
      const c = ctx();
      await update.onStartShift(c as any);
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('активна зміна'),
        expect.anything(),
      );
    });

    it('пропонує почати поза графіком, якщо немає розкладу', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findFirst.mockResolvedValue(null);
      prisma.workSchedule.findFirst.mockResolvedValue(null);
      prisma.department.findMany.mockResolvedValue([
        { id: 2, name: 'Почайна', telegramId: '777' },
      ]);
      const c = ctx();
      await update.onStartShift(c as any);
      expect(prisma.workShift.create).not.toHaveBeenCalled();
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('Поза графіком'),
        expect.anything(),
      );
    });

    it('повідомляє, якщо немає розкладу і жодного відділення', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findFirst.mockResolvedValue(null);
      prisma.workSchedule.findFirst.mockResolvedValue(null);
      const c = ctx();
      await update.onStartShift(c as any);
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('відділення'),
        expect.anything(),
      );
    });

    it('надсилає код на акаунт відділення за наявності розкладу', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        firstName: 'Іван',
        lastName: 'Тест',
      });
      prisma.workShift.findFirst.mockResolvedValue(null);
      prisma.workSchedule.findFirst.mockResolvedValue({
        departmentId: 2,
        startedAt: '09:00',
        endTime: '18:00',
        isDayOff: false,
        department: { name: 'Почайна', telegramId: '777' },
      });
      const c = ctx();
      await update.onStartShift(c as any);

      // Зміна ще НЕ створюється — лише надсилається код
      expect(prisma.workShift.create).not.toHaveBeenCalled();
      expect(c.telegram.sendMessage).toHaveBeenCalledWith(
        '777',
        expect.stringMatching(/Код підтвердження: <code>\d{4}<\/code>/),
        expect.anything(),
      );
      expect(redis.set).toHaveBeenCalledWith(
        'shift-verify:1',
        expect.stringContaining('"departmentId":2'),
        'EX',
        300, // 5 хвилин на введення коду
      );
      expect(c.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('код підтвердження'),
        expect.anything(),
      );
    });

    it('відмовляє, якщо відділення не підключене до Telegram', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        firstName: 'Іван',
        lastName: 'Тест',
      });
      prisma.workShift.findFirst.mockResolvedValue(null);
      prisma.workSchedule.findFirst.mockResolvedValue({
        departmentId: 2,
        startedAt: '09:00',
        endTime: '18:00',
        isDayOff: false,
        department: { name: 'Почайна', telegramId: null },
      });
      const c = ctx();
      await update.onStartShift(c as any);
      expect(c.telegram.sendMessage).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('не підключено до Telegram'),
        expect.anything(),
      );
    });
  });

  describe('onVerifyCode', () => {
    const verification = (over: Record<string, unknown> = {}) =>
      JSON.stringify({
        code: '1234',
        departmentId: 2,
        departmentName: 'Почайна',
        pressedAt: new Date().toISOString(),
        attempts: 0,
        ...over,
      });

    it('повідомляє, якщо немає активного запиту', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      const c = ctx('1234');
      await update.onVerifyCode(c as any);
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('Немає активного запиту'),
        expect.anything(),
      );
    });

    it('створює зміну поза графіком з часом натискання кнопки', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findFirst.mockResolvedValue(null);
      prisma.workSchedule.findFirst.mockResolvedValue(null);
      prisma.department.findMany.mockResolvedValue([
        { id: 2, name: 'Почайна', telegramId: '777' },
      ]);
      const pressedAt = new Date();
      pressedAt.setHours(9, 5, 0, 0);
      redis.get.mockResolvedValue(
        verification({ pressedAt: pressedAt.toISOString() }),
      );
      const c = ctx('1234');
      await update.onVerifyCode(c as any);

      expect(redis.del).toHaveBeenCalledWith('shift-verify:1');
      expect(prisma.workShift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            departmentId: 2,
            startedAt: '09:05',
            tags: { connect: [{ id: 99 }] },
          }),
        }),
      );
      expect(prisma.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'Поза графіком' },
          create: expect.objectContaining({
            name: 'Поза графіком',
            severity: 2,
            isSystem: true,
          }),
        }),
      );
      expect(c.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('розпочато'),
        expect.anything(),
      );
    });

    it('відхиляє невірний код і рахує спроби', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      redis.get.mockResolvedValue(verification());
      const c = ctx('9999');
      await update.onVerifyCode(c as any);

      expect(prisma.workShift.create).not.toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        'shift-verify:1',
        expect.stringContaining('"attempts":1'),
        'KEEPTTL',
      );
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('Невірний код'),
      );
    });

    it('скасовує запит після вичерпання спроб', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      redis.get.mockResolvedValue(verification({ attempts: 4 }));
      const c = ctx('9999');
      await update.onVerifyCode(c as any);

      expect(redis.del).toHaveBeenCalledWith('shift-verify:1');
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('Забагато невдалих спроб'),
        expect.anything(),
      );
    });
  });

  describe('onDepartmentLinkCode', () => {
    it('привʼязує чат до відділення за дійсним кодом', async () => {
      departmentLink.consumeCode.mockResolvedValue({ id: 2, name: 'Почайна' });
      const c = ctx('DEP-A2B3C');
      await update.onDepartmentLinkCode(c as any);

      // сама прив'язка живе в DepartmentLinkService — спільна з адмінкою
      expect(departmentLink.consumeCode).toHaveBeenCalledWith(
        'DEP-A2B3C',
        '123',
      );
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('Почайна'),
      );
    });

    it('повідомляє про недійсний код привʼязки', async () => {
      departmentLink.consumeCode.mockResolvedValue(null);
      const c = ctx('DEP-A2B3C');
      await update.onDepartmentLinkCode(c as any);
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('недійсний'),
      );
    });
  });

  describe('onEndShift', () => {
    it('повідомляє, якщо акаунт не підключено', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const c = ctx();
      await update.onEndShift(c as any);
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('не підключено'),
      );
    });

    it('повідомляє про відсутність активних змін', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findFirst.mockResolvedValue(null);
      const c = ctx();
      await update.onEndShift(c as any);
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('немає активних'),
        expect.anything(),
      );
    });

    it('завершує активну зміну з підрахунком годин', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findFirst.mockResolvedValue({
        id: 5,
        startedAt: '00:00',
      });
      const c = ctx();
      await update.onEndShift(c as any);
      expect(prisma.workShift.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5 } }),
      );
      expect(c.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('завершено'),
        expect.anything(),
      );
    });

    it('обнуляє години, якщо старт у майбутньому (відʼємний інтервал)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      // Дата зміни — завтра: (now - start) < 0 → clamp до 0
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.workShift.findFirst.mockResolvedValue({
        id: 6,
        date: tomorrow,
        startedAt: '00:00',
      });
      const c = ctx();
      await update.onEndShift(c as any);
      expect(prisma.workShift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalHours: 0 }),
        }),
      );
    });
  });
});
