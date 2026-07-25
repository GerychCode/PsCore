import { ScheduleGeneratorService, GenMember, GenDay } from './schedule.generator.service';

describe('ScheduleGeneratorService.computeAssignments', () => {
  let service: ScheduleGeneratorService;

  beforeEach(() => {
    // Чисте ядро не торкається залежностей
    service = new ScheduleGeneratorService(
      null as any,
      null as any,
      null as any,
      null as any,
    );
  });

  const member = (userId: number, level = 1, reliability = 0): GenMember => ({
    userId,
    level,
    reliability,
  });

  const day = (
    weekday: number,
    required: number,
    opts: Partial<GenDay> = {},
  ): GenDay => ({
    weekday,
    required,
    busyUserIds: opts.busyUserIds ?? [],
    coveredCount: opts.coveredCount ?? 0,
    wishUserIds: opts.wishUserIds ?? [],
    shiftHours: opts.shiftHours ?? 8,
  });

  it('заповнює потрібну к-сть слотів на день', () => {
    const days = [day(1, 2)];
    const members = [member(1), member(2), member(3)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(2);
    expect(assignments.every((a) => a.weekday === 1)).toBe(true);
  });

  it('не перевищує наявних людей і сигналізує недокомплект', () => {
    const days = [day(1, 3)];
    const members = [member(1), member(2)];
    const { assignments, warnings } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(2);
    expect(warnings.some((w) => w.type === 'UNDERSTAFFED')).toBe(true);
  });

  it('враховує published-зміну цього відділу: 1 покрито → потрібен ще 1, і не user 1', () => {
    // user1 вже працює цього дня в цьому відділі (published) → covered=1, busy=[1]
    const days = [day(1, 2, { busyUserIds: [1], coveredCount: 1 })];
    const members = [member(1), member(2), member(3)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].userId).not.toBe(1);
  });

  it('виключає зайнятого в ІНШОМУ відділі, не зменшуючи потребу цього', () => {
    // user1 зайнятий деінде (busy) але covered=0 → потрібно всі 2 з інших
    const days = [day(1, 2, { busyUserIds: [1], coveredCount: 0 })];
    const members = [member(1), member(2), member(3)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(2);
    expect(assignments.map((a) => a.userId)).not.toContain(1);
  });

  it('уникає побажань вихідного, якщо є ким замінити', () => {
    const days = [day(1, 1, { wishUserIds: [1] })];
    const members = [member(1), member(2)];
    const { assignments, warnings } = service.computeAssignments(days, members);
    expect(assignments[0].userId).toBe(2);
    expect(warnings).toHaveLength(0);
  });

  it('порушує побажання лише за відсутності альтернатив і попереджає', () => {
    const days = [day(1, 1, { wishUserIds: [1] })];
    const members = [member(1)];
    const { assignments, warnings } = service.computeAssignments(days, members);
    expect(assignments[0].userId).toBe(1);
    expect(warnings.some((w) => w.type === 'WISH_VIOLATED')).toBe(true);
  });

  it('на пікові дні ставить сильніших', () => {
    // Пн потребує 1 (спокійний), Сб потребує 3 (піковий, > середнього)
    const days = [day(1, 1), day(6, 3)];
    const members = [
      member(1, 10),
      member(2, 1),
      member(3, 1),
      member(4, 1),
    ];
    const { assignments } = service.computeAssignments(days, members);
    const saturday = assignments
      .filter((a) => a.weekday === 6)
      .map((a) => a.userId);
    // Сильний (userId 1, LVL 10) має потрапити в піковий день
    expect(saturday).toContain(1);
  });

  it('рівномірно розподіляє зміни між людьми', () => {
    // 3 дні по 1 людині, 3 людини — кожен має отримати рівно 1
    const days = [day(1, 1), day(2, 1), day(3, 1)];
    const members = [member(1), member(2), member(3)];
    const { assignments } = service.computeAssignments(days, members);
    const counts = new Map<number, number>();
    assignments.forEach((a) =>
      counts.set(a.userId, (counts.get(a.userId) ?? 0) + 1),
    );
    expect([...counts.values()]).toEqual([1, 1, 1]);
  });

  it('ігнорує дні з нульовим штатом', () => {
    const days = [day(1, 0), day(2, 1)];
    const members = [member(1)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].weekday).toBe(2);
  });

  it('детермінований за рівного скору (менший userId першим)', () => {
    const days = [day(1, 1)];
    const members = [member(3), member(1), member(2)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments[0].userId).toBe(1);
  });
});

describe('ScheduleGeneratorService (БД-оркестрація)', () => {
  let service: ScheduleGeneratorService;
  let prisma: any;
  let levels: any;
  let events: any;
  let notifications: any;

  const department = {
    id: 1,
    staffingByWeekday: { '1': 1 },
    weekdaysOpeningTime: '09:00',
    weekdaysClosingTime: '18:00',
    weekendsOpeningTime: '10:00',
    weekendsClosingTime: '16:00',
  };

  beforeEach(() => {
    prisma = {
      department: { findUnique: jest.fn().mockResolvedValue(department) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 2 }]) },
      workSchedule: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      scheduleWish: { findMany: jest.fn().mockResolvedValue([]) },
    };
    levels = {
      getEmployeeLevel: jest
        .fn()
        .mockResolvedValue({ userId: 2, level: 1, reliability: 0 }),
    };
    events = { server: { emit: jest.fn() } };
    notifications = { createNotification: jest.fn().mockResolvedValue(null) };
    service = new ScheduleGeneratorService(
      prisma,
      levels,
      events,
      notifications,
    );
  });

  describe('generateWeek', () => {
    it('створює чернетки й повертає {created, warnings}', async () => {
      // побажання вихідного цього дня — покриває фільтр wishUserIds
      prisma.scheduleWish.findMany.mockResolvedValue([
        { userId: 2, date: new Date('2026-06-01') },
      ]);
      const res = await service.generateWeek(1, '2026-06-01'); // понеділок
      expect(prisma.workSchedule.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
      expect(events.server.emit).toHaveBeenCalledWith('invalidate_schedules');
      expect(res.created).toBe(1);
    });

    it('вихідний у цьому відділенні НЕ зараховується як покритий слот', async () => {
      // Опублікований вихідний user 2 на понеділок: людина того дня не працює,
      // тож потреба лишається, і генератор мусить когось поставити.
      prisma.workSchedule.findMany.mockResolvedValue([
        {
          userId: 2,
          date: new Date('2026-06-01'),
          departmentId: 1,
          isDraft: false,
          isDayOff: true,
        },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 2 }, { id: 3 }]);
      levels.getEmployeeLevel.mockImplementation((id: number) =>
        Promise.resolve({ userId: id, level: 1, reliability: 0 }),
      );

      await service.generateWeek(1, '2026-06-01');

      // штат у фікстурі — лише понеділок ({'1': 1}), тож усі рядки саме за нього
      const rows = prisma.workSchedule.createMany.mock.calls[0][0].data;
      // user 2 зайнятий (вихідний), тож слот має закрити user 3
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(3);
    });

    it('пропущені через гонку рядки дають UNDERSTAFFED', async () => {
      // createMany вставив менше, ніж просили
      prisma.workSchedule.createMany.mockResolvedValue({ count: 0 });
      const res = await service.generateWeek(1, '2026-06-01');
      expect(res.created).toBe(0);
      expect(res.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'UNDERSTAFFED' }),
        ]),
      );
    });

    it('відділення не знайдено → BadRequest', async () => {
      prisma.department.findUnique.mockResolvedValue(null);
      await expect(service.generateWeek(1, '2026-06-01')).rejects.toThrow(
        'Відділення не знайдено.',
      );
    });

    it('штат не заданий → BadRequest', async () => {
      prisma.department.findUnique.mockResolvedValue({
        ...department,
        staffingByWeekday: {},
      });
      await expect(service.generateWeek(1, '2026-06-01')).rejects.toThrow(
        /штат/i,
      );
    });

    it('немає членів команди → BadRequest', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await expect(service.generateWeek(1, '2026-06-01')).rejects.toThrow(
        /співробітник/i,
      );
    });

    it('порожній результат — createMany не викликається', async () => {
      // штат є, але жоден день не потребує (усі 0) → rows порожні
      prisma.department.findUnique.mockResolvedValue({
        ...department,
        staffingByWeekday: { '1': 0, '3': 0 },
      });
      // щоб пройти перевірку totalStaff>0 — додамо додатний, але без кандидатів
      prisma.department.findUnique.mockResolvedValue({
        ...department,
        staffingByWeekday: { '1': 1 },
      });
      prisma.workSchedule.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([{ id: 2 }]);
      // busy усіх → нема кого призначити
      prisma.workSchedule.findMany.mockResolvedValue([
        { userId: 2, date: new Date('2026-06-01'), departmentId: 9, isDraft: false },
      ]);
      const res = await service.generateWeek(1, '2026-06-01');
      expect(res.created).toBe(0);
    });
  });

  describe('publishWeek сповіщає', () => {
    it('шле повідомлення кожному, чию чернетку опублікували', async () => {
      prisma.workSchedule.findMany.mockResolvedValue([
        { userId: 2 },
        { userId: 3 },
      ]);
      await service.publishWeek(1, '2026-06-01');
      expect(notifications.createNotification).toHaveBeenCalledTimes(2);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ title: 'Графік опубліковано' }),
      );
    });
  });

  describe('publishWeek', () => {
    it('знімає isDraft і повертає {published}', async () => {
      const res = await service.publishWeek(1, '2026-06-01');
      expect(prisma.workSchedule.updateMany).toHaveBeenCalled();
      expect(events.server.emit).toHaveBeenCalledWith('invalidate_schedules');
      expect(res.published).toBe(3);
    });
  });

  describe('rejectWeek', () => {
    it('видаляє чернетки і повертає {discarded}', async () => {
      prisma.workSchedule.deleteMany.mockResolvedValue({ count: 2 });
      const res = await service.rejectWeek(1, '2026-06-01');
      expect(res.discarded).toBe(2);
      expect(events.server.emit).toHaveBeenCalledWith('invalidate_schedules');
    });
  });
});
