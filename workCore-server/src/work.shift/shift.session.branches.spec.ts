import { ShiftSessionService } from './shift.session.service';

describe('ShiftSessionService (додаткові гілки)', () => {
  let service: ShiftSessionService;
  let prisma: any;

  const schedule = {
    departmentId: 1,
    department: { name: 'A', telegramId: '1' },
    isDayOff: false,
    startedAt: '09:00',
  };

  beforeEach(() => {
    prisma = {
      workShift: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      workSchedule: { findFirst: jest.fn().mockResolvedValue(schedule) },
      tag: { upsert: jest.fn().mockResolvedValue({ id: 1 }) },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    const userService = { getAdmins: jest.fn().mockResolvedValue([]) } as any;
    const events = { emitToUsers: jest.fn() } as any;
    const tagRuleEngine = { apply: jest.fn().mockResolvedValue([]) } as any;
    service = new ShiftSessionService(
      prisma,
      userService,
      events,
      tagRuleEngine,
    );
  });

  it('checkShiftStart → OVERLAP, якщо поточний час перетинає наявну зміну', async () => {
    prisma.workShift.findFirst.mockResolvedValue(null); // нема активної
    prisma.workShift.findMany.mockResolvedValue([
      { id: 5, date: new Date(), startedAt: '00:00', endTime: '23:59' },
    ]);
    const res = await service.checkShiftStart(1);
    expect(res.status).toBe('OVERLAP');
  });

  it('startShift → ALREADY_ACTIVE, якщо транзакція виявляє активну зміну', async () => {
    prisma.workShift.findFirst
      .mockResolvedValueOnce(null) // checkShiftStart: нема активної
      .mockResolvedValueOnce({ id: 9 }); // re-check у транзакції: є активна
    const res = await service.startShift(1);
    expect(res.status).toBe('ALREADY_ACTIVE');
  });

  it('startShift прокидає інші помилки транзакції далі', async () => {
    prisma.workShift.findFirst.mockResolvedValue(null);
    prisma.$transaction = jest.fn(async () => {
      throw new Error('db down');
    });
    await expect(service.startShift(1)).rejects.toThrow('db down');
  });
});
