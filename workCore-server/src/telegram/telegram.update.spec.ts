import { TelegramUpdate } from './telegram.update';
import { ShiftSessionService } from '../work.shift/shift.session.service';

describe('TelegramUpdate', () => {
  let update: TelegramUpdate;
  let prisma: any;
  let redis: { get: jest.Mock; del: jest.Mock };
  let events: { emitToUsers: jest.Mock };

  const ctx = (text?: string) => ({
    message: { text },
    from: { id: 123 },
    reply: jest.fn().mockResolvedValue(undefined),
    replyWithHTML: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    prisma = {
      user: { update: jest.fn(), findUnique: jest.fn() },
      workShift: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      workSchedule: { findFirst: jest.fn() },
      tag: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 99 }),
      },
    };
    redis = { get: jest.fn(), del: jest.fn() };
    events = { emitToUsers: jest.fn() };
    const userService = { getAdmins: jest.fn().mockResolvedValue([]) };
    const shiftSession = new ShiftSessionService(
      prisma,
      userService as any,
      events as any,
    );
    update = new TelegramUpdate(prisma, redis as any, shiftSession);
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

    it('повідомляє про відсутність розкладу на сьогодні', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findFirst.mockResolvedValue(null);
      prisma.workSchedule.findFirst.mockResolvedValue(null);
      const c = ctx();
      await update.onStartShift(c as any);
      expect(c.reply).toHaveBeenCalledWith(
        expect.stringContaining('немає запланованої'),
        expect.anything(),
      );
    });

    it('створює зміну за наявності розкладу', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findFirst.mockResolvedValue(null);
      prisma.workSchedule.findFirst.mockResolvedValue({
        departmentId: 2,
        startedAt: '09:00',
        endTime: '18:00',
        isDayOff: false,
        department: { name: 'Почайна' },
      });
      const c = ctx();
      await update.onStartShift(c as any);
      expect(prisma.workShift.create).toHaveBeenCalled();
      expect(c.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('розпочато'),
        expect.anything(),
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

    it('обнуляє години, якщо розрахунок дав відʼємне значення', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findFirst.mockResolvedValue({
        id: 6,
        startedAt: '23:59',
      });
      const c = ctx();
      await update.onEndShift(c as any);
      expect(prisma.workShift.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalHours: 0 }) }),
      );
    });
  });
});
