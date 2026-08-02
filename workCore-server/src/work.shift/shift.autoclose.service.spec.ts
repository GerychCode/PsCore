import { ShiftAutoCloseService } from './shift.autoclose.service';
import { AuditAction } from '../audit/audit.actions';

describe('ShiftAutoCloseService', () => {
  let service: ShiftAutoCloseService;
  let prisma: any;
  let shiftSession: any;
  let notifications: any;
  let audit: any;

  const day = new Date('2026-06-01T00:00:00');

  beforeEach(() => {
    prisma = {
      workShift: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      workSchedule: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    shiftSession = {
      getSystemTag: jest.fn().mockImplementation((spec) =>
        Promise.resolve({ id: spec.name.length }),
      ),
      notifyShiftChanged: jest.fn().mockResolvedValue(undefined),
    };
    notifications = { createNotification: jest.fn().mockResolvedValue(null) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const tagRuleEngine = { apply: jest.fn().mockResolvedValue([]) } as any;
    service = new ShiftAutoCloseService(
      prisma,
      shiftSession,
      notifications,
      audit,
      tagRuleEngine,
    );
  });

  it('поза графіком — виставляє +10 годин від початку', async () => {
    prisma.workShift.findMany.mockResolvedValue([
      { id: 5, userId: 7, date: day, startedAt: '09:00', endTime: '' },
    ]);
    prisma.workSchedule.findFirst.mockResolvedValue(null);

    const res = await service.closeActiveShifts();

    expect(res).toEqual({ closed: 1 });
    const updateArg = prisma.workShift.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 5 });
    expect(updateArg.data.endTime).toBe('19:00');
    expect(updateArg.data.totalHours).toBe(10);
    expect(updateArg.data.tags.connect.length).toBe(2);
  });

  it('за графіком — бере час завершення з розкладу', async () => {
    prisma.workShift.findMany.mockResolvedValue([
      { id: 6, userId: 7, date: day, startedAt: '09:00', endTime: '' },
    ]);
    prisma.workSchedule.findFirst.mockResolvedValue({
      isDayOff: false,
      endTime: '18:00',
    });

    await service.closeActiveShifts();

    const updateArg = prisma.workShift.update.mock.calls[0][0];
    expect(updateArg.data.endTime).toBe('18:00');
    expect(updateArg.data.totalHours).toBe(9);
  });

  it('нічна зміна за графіком (кінець наступного дня)', async () => {
    prisma.workShift.findMany.mockResolvedValue([
      { id: 8, userId: 7, date: day, startedAt: '22:00', endTime: '' },
    ]);
    prisma.workSchedule.findFirst.mockResolvedValue({
      isDayOff: false,
      endTime: '06:00',
    });

    await service.closeActiveShifts();

    const updateArg = prisma.workShift.update.mock.calls[0][0];
    expect(updateArg.data.endTime).toBe('06:00');
    expect(updateArg.data.totalHours).toBe(8);
  });

  it('вихідний за графіком трактується як поза графіком (+10 год)', async () => {
    prisma.workShift.findMany.mockResolvedValue([
      { id: 9, userId: 7, date: day, startedAt: '08:00', endTime: '' },
    ]);
    prisma.workSchedule.findFirst.mockResolvedValue({
      isDayOff: true,
      endTime: '18:00',
    });

    await service.closeActiveShifts();
    expect(prisma.workShift.update.mock.calls[0][0].data.totalHours).toBe(10);
  });

  it('сповіщає працівника і пише системний аудит', async () => {
    prisma.workShift.findMany.mockResolvedValue([
      { id: 5, userId: 7, date: day, startedAt: '09:00', endTime: '' },
    ]);

    await service.closeActiveShifts();

    expect(notifications.createNotification).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ category: 'shift' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        action: AuditAction.SHIFT_AUTO_CLOSED,
        entity: 'WorkShift',
        entityId: 5,
      }),
    );
    expect(shiftSession.notifyShiftChanged).toHaveBeenCalledWith(7);
  });

  it('нема активних змін — нічого не робить', async () => {
    prisma.workShift.findMany.mockResolvedValue([]);
    const res = await service.closeActiveShifts();
    expect(res).toEqual({ closed: 0 });
    expect(prisma.workShift.update).not.toHaveBeenCalled();
  });

  it('падіння на одній зміні не зупиняє решту', async () => {
    prisma.workShift.findMany.mockResolvedValue([
      { id: 1, userId: 1, date: day, startedAt: '09:00', endTime: '' },
      { id: 2, userId: 2, date: day, startedAt: '09:00', endTime: '' },
    ]);
    prisma.workShift.update
      .mockRejectedValueOnce(new Error('db'))
      .mockResolvedValueOnce({});

    const res = await service.closeActiveShifts();
    expect(res).toEqual({ closed: 1 });
  });

  describe('планувальник (таймер)', () => {
    afterEach(() => jest.useRealTimers());

    it('onModuleInit ставить таймер; onModuleDestroy його чистить', () => {
      jest.useFakeTimers();
      const spy = jest
        .spyOn(service, 'closeActiveShifts')
        .mockResolvedValue({ closed: 0 });
      service.onModuleInit();
      // до півночі далеко — колбек ще не спрацював
      expect(spy).not.toHaveBeenCalled();
      service.onModuleDestroy();
    });

    it('спрацювання таймера викликає closeActiveShifts і переплановує', async () => {
      jest.useFakeTimers();
      const spy = jest
        .spyOn(service, 'closeActiveShifts')
        .mockResolvedValue({ closed: 0 });
      const reschedule = jest.spyOn<any, any>(
        service as any,
        'scheduleNextRun',
      );
      service.onModuleInit();
      // awaits microtasks → виконує .catch().finally(scheduleNextRun)
      await jest.runOnlyPendingTimersAsync();
      expect(spy).toHaveBeenCalled();
      // finally переплановує (перший виклик — з onModuleInit, другий — з finally)
      expect(reschedule.mock.calls.length).toBeGreaterThanOrEqual(2);
      service.onModuleDestroy();
    });

    it('колбек ловить помилку closeActiveShifts', async () => {
      jest.useFakeTimers();
      jest
        .spyOn(service, 'closeActiveShifts')
        .mockRejectedValue(new Error('fail'));
      service.onModuleInit();
      await jest.runOnlyPendingTimersAsync();
      // не кинуло — помилка проковтнута в .catch
      service.onModuleDestroy();
    });

    it('onModuleDestroy без таймера не падає', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });

    it('реальний таймер: unref і очищення', () => {
      // без fake timers — реальний Timeout має unref()
      service.onModuleInit();
      service.onModuleDestroy();
    });
  });
});
