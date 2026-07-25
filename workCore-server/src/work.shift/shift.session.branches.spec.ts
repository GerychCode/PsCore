import { ShiftSessionService } from './shift.session.service';
import { SYSTEM_TAGS } from '../work.shift.tag/system-tags';

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
      department: {
        findMany: jest.fn().mockResolvedValue([]),
        // геоперевірка вимкнена за замовчуванням у тестах
        findUnique: jest.fn().mockResolvedValue(null),
      },
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

  describe('геоперевірка', () => {
    // Майдан Незалежності — і точка за ~1.1 км від нього
    const site = { latitude: 50.45011, longitude: 30.52341 };
    const far = { latitude: 50.46011, longitude: 30.52341 };

    const GEO_TAG_ID = 99;

    const startWithGeo = async (
      radius: number | null,
      coords: { latitude: number; longitude: number } | null,
    ) => {
      prisma.workShift.findFirst.mockResolvedValue(null);
      prisma.workShift.create.mockResolvedValue({ id: 1 });
      // окремий id саме для гео-тега, щоб не плутати з тегами графіка
      prisma.tag.upsert.mockImplementation(({ where }: any) =>
        Promise.resolve({
          id:
            where.name === SYSTEM_TAGS.FAR_FROM_SITE.name ? GEO_TAG_ID : 1,
        }),
      );
      prisma.department.findUnique.mockResolvedValue({
        ...site,
        geofenceRadiusM: radius,
      });
      await service.startShift(1, undefined, undefined, coords);
      return prisma.workShift.create.mock.calls[0][0].data.tags.connect;
    };

    it('вішає тег, коли зміну відкрито поза радіусом', async () => {
      const connected = await startWithGeo(100, far);
      expect(connected).toContainEqual({ id: GEO_TAG_ID });
    });

    it('не вішає тег у межах радіуса', async () => {
      const connected = await startWithGeo(2000, far);
      expect(connected).not.toContainEqual({ id: GEO_TAG_ID });
    });

    it('без геопозиції тегу немає — невідомо не означає порушення', async () => {
      const connected = await startWithGeo(100, null);
      expect(connected).not.toContainEqual({ id: GEO_TAG_ID });
    });

    it('перевірка вимкнена, коли радіус не заданий', async () => {
      const connected = await startWithGeo(null, far);
      expect(connected).not.toContainEqual({ id: GEO_TAG_ID });
    });
  });

  it('startShift прокидає інші помилки транзакції далі', async () => {
    prisma.workShift.findFirst.mockResolvedValue(null);
    prisma.$transaction = jest.fn(async () => {
      throw new Error('db down');
    });
    await expect(service.startShift(1)).rejects.toThrow('db down');
  });
});
