import { TagRuleEngine } from './tag-rule.engine';
import { ShiftRuleContext } from './tag-rule.types';

describe('TagRuleEngine', () => {
  let engine: TagRuleEngine;
  let prisma: any;
  let notifications: any;

  const ctx: ShiftRuleContext = {
    userId: 7,
    departmentId: 3,
    totalHours: 10,
    startHour: 9,
    endHour: 19,
    weekday: 6,
    late: false,
    offSchedule: false,
    isDayOff: false,
    status: 'PENDING',
  };

  const overtimeTag = {
    id: 50,
    name: 'Овертайм',
    rule: {
      trigger: 'SHIFT_ENDED',
      match: 'ALL',
      conditions: [{ field: 'totalHours', op: 'gt', value: 8 }],
      actions: [
        { type: 'NOTIFY_USER', title: 'Овертайм', message: '{totalHours} год' },
      ],
    },
  };

  beforeEach(() => {
    prisma = {
      tag: { findMany: jest.fn().mockResolvedValue([]) },
      workShift: { update: jest.fn().mockResolvedValue({}) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ firstName: 'Іван', lastName: 'П' }),
        findMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      },
    };
    notifications = { createNotification: jest.fn().mockResolvedValue(null) };
    engine = new TagRuleEngine(prisma, notifications);
  });

  it('нема автозастосовних тегів → нічого', async () => {
    prisma.tag.findMany.mockResolvedValue([]);
    const res = await engine.apply('SHIFT_ENDED', 100, ctx);
    expect(res).toEqual([]);
    expect(prisma.workShift.update).not.toHaveBeenCalled();
  });

  it('тег зі збігом умов навішується і шле NOTIFY_USER', async () => {
    prisma.tag.findMany.mockResolvedValue([overtimeTag]);
    const res = await engine.apply('SHIFT_ENDED', 100, ctx);

    expect(res).toEqual([50]);
    expect(prisma.workShift.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { tags: { connect: [{ id: 50 }] } },
    });
    expect(notifications.createNotification).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ message: '10 год' }),
    );
  });

  it('інший тригер — не спрацьовує', async () => {
    prisma.tag.findMany.mockResolvedValue([overtimeTag]);
    const res = await engine.apply('SHIFT_STARTED', 100, ctx);
    expect(res).toEqual([]);
    expect(prisma.workShift.update).not.toHaveBeenCalled();
  });

  it('NOTIFY_MANAGERS сповіщає всіх менеджерів', async () => {
    prisma.tag.findMany.mockResolvedValue([
      {
        id: 60,
        name: 'Контроль',
        rule: {
          trigger: 'SHIFT_ENDED',
          match: 'ALL',
          conditions: [],
          actions: [{ type: 'NOTIFY_MANAGERS', title: 'Перевірити', message: '' }],
        },
      },
    ]);
    await engine.apply('SHIFT_ENDED', 100, ctx);
    // 2 менеджери
    expect(notifications.createNotification).toHaveBeenCalledWith(
      1,
      expect.any(Object),
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      2,
      expect.any(Object),
    );
  });

  it('best-effort: збій БД не кидає помилку', async () => {
    prisma.tag.findMany.mockRejectedValue(new Error('db down'));
    await expect(engine.apply('SHIFT_ENDED', 100, ctx)).resolves.toEqual([]);
  });

  it('owner null → userName порожній; дія з дефолтним заголовком', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.tag.findMany.mockResolvedValue([
      {
        id: 70,
        name: 'Тег',
        rule: {
          trigger: 'SHIFT_ENDED',
          match: 'ALL',
          conditions: [],
          actions: [{ type: 'NOTIFY_USER' }], // без title/message → дефолти
        },
      },
    ]);
    await engine.apply('SHIFT_ENDED', 1, ctx);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: expect.stringContaining('Тег') }),
    );
  });

  it('тег без actions — навішується, дій не виконує', async () => {
    prisma.tag.findMany.mockResolvedValue([
      {
        id: 71,
        name: 'Мітка',
        rule: { trigger: 'SHIFT_ENDED', match: 'ALL', conditions: [], actions: [] },
      },
    ]);
    const res = await engine.apply('SHIFT_ENDED', 1, ctx);
    expect(res).toEqual([71]);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
});
