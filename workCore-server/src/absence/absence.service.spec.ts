import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AbsenceService } from './absence.service';
import { AuditAction } from '../audit/audit.actions';

describe('AbsenceService', () => {
  let service: AbsenceService;
  let prisma: any;
  let notifications: any;
  let events: any;
  let audit: any;

  const employee = { id: 2, firstName: 'Іван', lastName: 'П', role: 'Employe', appRoles: [] } as any;
  const manager = { id: 1, firstName: 'Ольга', lastName: 'М', role: 'Admin', appRoles: [] } as any;

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const inDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };

  beforeEach(() => {
    prisma = {
      absence: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(async ({ data }: any) => ({ id: 10, ...data })),
        update: jest.fn(async ({ data }: any) => ({
          id: 10,
          userId: 2,
          type: 'VACATION',
          startDate: inDays(5),
          endDate: inDays(9),
          ...data,
        })),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ vacationDaysPerYear: 24 }),
        findMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      },
      workSchedule: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    notifications = { createNotification: jest.fn().mockResolvedValue(null) };
    events = { emitToAll: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new AbsenceService(prisma, notifications, events, audit);
  });

  const dto = (over: any = {}) => ({
    type: 'VACATION',
    startDate: iso(inDays(5)),
    endDate: iso(inDays(9)),
    ...over,
  });

  describe('create', () => {
    it('працівник подає заявку — вона чекає рішення', async () => {
      const res = await service.create(employee, dto() as any);
      expect(res.status).toBe('PENDING');
      expect(prisma.workSchedule.deleteMany).not.toHaveBeenCalled();
    });

    it('менеджер оформлює відсутність одразу погодженою', async () => {
      const res: any = await service.create(manager, dto() as any);
      expect(res.status).toBe('APPROVED');
      // погоджена відсутність одразу звільняє планові зміни
      expect(prisma.workSchedule.deleteMany).toHaveBeenCalled();
    });

    it('відмовляє, якщо кінець раніший за початок', async () => {
      await expect(
        service.create(
          employee,
          dto({ startDate: iso(inDays(9)), endDate: iso(inDays(5)) }) as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('працівник не може подати заявку заднім числом', async () => {
      await expect(
        service.create(
          employee,
          dto({ startDate: iso(inDays(-5)), endDate: iso(inDays(-1)) }) as any,
        ),
      ).rejects.toThrow(/минулі дні/);
    });

    it('менеджер може оформити лікарняний заднім числом', async () => {
      const res: any = await service.create(
        manager,
        dto({
          type: 'SICK',
          startDate: iso(inDays(-5)),
          endDate: iso(inDays(-1)),
        }) as any,
      );
      expect(res.status).toBe('APPROVED');
    });

    it('відмовляє при перетині з наявною відсутністю', async () => {
      prisma.absence.findFirst.mockResolvedValue({ id: 7 });
      await expect(service.create(employee, dto() as any)).rejects.toThrow(
        /вже є заявка/,
      );
    });

    it('відмовляє, коли не вистачає днів відпустки', async () => {
      // 24 дні норми, 23 вже використано → лишився 1, а просять 5
      prisma.absence.findMany.mockResolvedValue([
        {
          startDate: new Date(new Date().getFullYear(), 0, 1),
          endDate: new Date(new Date().getFullYear(), 0, 23),
          status: 'APPROVED',
        },
      ]);
      await expect(service.create(employee, dto() as any)).rejects.toThrow(
        /Недостатньо днів/,
      );
    });

    it('лікарняний баланс відпустки не перевіряє', async () => {
      prisma.absence.findMany.mockResolvedValue([
        {
          startDate: new Date(new Date().getFullYear(), 0, 1),
          endDate: new Date(new Date().getFullYear(), 11, 31),
          status: 'APPROVED',
        },
      ]);
      const res = await service.create(employee, dto({ type: 'SICK' }) as any);
      expect(res.status).toBe('PENDING');
    });
  });

  describe('vacationBalance', () => {
    it('заброньовані дні зменшують доступний залишок', async () => {
      prisma.absence.findMany.mockResolvedValue([
        {
          startDate: new Date(new Date().getFullYear(), 0, 1),
          endDate: new Date(new Date().getFullYear(), 0, 5),
          status: 'APPROVED',
        },
        {
          startDate: new Date(new Date().getFullYear(), 1, 1),
          endDate: new Date(new Date().getFullYear(), 1, 3),
          status: 'PENDING',
        },
      ]);
      const res = await service.vacationBalance(2);
      expect(res.used).toBe(5);
      expect(res.pending).toBe(3);
      expect(res.remaining).toBe(24 - 5 - 3);
    });

    it('залишок не буває відʼємним', async () => {
      prisma.absence.findMany.mockResolvedValue([
        {
          startDate: new Date(new Date().getFullYear(), 0, 1),
          endDate: new Date(new Date().getFullYear(), 2, 1),
          status: 'APPROVED',
        },
      ]);
      const res = await service.vacationBalance(2);
      expect(res.remaining).toBe(0);
    });
  });

  describe('approve / reject / cancel', () => {
    const pending = (over: any = {}) => ({
      id: 10,
      userId: 2,
      type: 'VACATION',
      status: 'PENDING',
      startDate: inDays(5),
      endDate: inDays(9),
      ...over,
    });

    it('погодження звільняє планові зміни й пише аудит', async () => {
      prisma.absence.findUnique.mockResolvedValue(pending());
      prisma.workSchedule.deleteMany.mockResolvedValue({ count: 3 });

      const res: any = await service.approve(manager, 10, {} as any);

      expect(res.freedScheduleDays).toBe(3);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.ABSENCE_APPROVED }),
      );
      expect(notifications.createNotification).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ title: 'Відсутність погоджено' }),
      );
    });

    it('не можна погодити двічі', async () => {
      prisma.absence.findUnique.mockResolvedValue(pending({ status: 'APPROVED' }));
      await expect(service.approve(manager, 10, {} as any)).rejects.toThrow(
        /вже розглянуто/,
      );
    });

    it('відмова не чіпає графік', async () => {
      prisma.absence.findUnique.mockResolvedValue(pending());
      await service.reject(manager, 10, { comment: 'пік сезону' } as any);
      expect(prisma.workSchedule.deleteMany).not.toHaveBeenCalled();
    });

    it('чужу заявку працівник скасувати не може', async () => {
      prisma.absence.findUnique.mockResolvedValue(pending({ userId: 99 }));
      await expect(service.cancel(employee, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('погоджену відсутність, що вже почалась, працівник не скасовує', async () => {
      prisma.absence.findUnique.mockResolvedValue(
        pending({ status: 'APPROVED', startDate: inDays(-1) }),
      );
      await expect(service.cancel(employee, 10)).rejects.toThrow(
        /через менеджера/,
      );
    });

    it('менеджер скасовує й таку', async () => {
      prisma.absence.findUnique.mockResolvedValue(
        pending({ status: 'APPROVED', startDate: inDays(-1) }),
      );
      const res = await service.cancel(manager, 10);
      expect(res.status).toBe('CANCELLED');
    });
  });

  describe('absentUserIds', () => {
    it('розгортає проміжок у дні, обрізаючи за межами тижня', async () => {
      const from = new Date(2026, 5, 1);
      const to = new Date(2026, 5, 7);
      prisma.absence.findMany.mockResolvedValue([
        {
          userId: 2,
          startDate: new Date(2026, 4, 28),
          endDate: new Date(2026, 5, 3),
        },
      ]);

      const map = await service.absentUserIds(from, to);
      const days = map.get(2)!;
      // 1, 2, 3 червня — початок обрізано межею тижня
      expect(days).toHaveLength(3);
      expect(days[0].getDate()).toBe(1);
      expect(days[2].getDate()).toBe(3);
    });
  });
});
