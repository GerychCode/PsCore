import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ShiftSwapService } from './shift.swap.service';
import { AuditAction } from '../audit/audit.actions';
import { Prisma } from '../../generated/prisma';

describe('ShiftSwapService', () => {
  let service: ShiftSwapService;
  let prisma: any;
  let notifications: any;
  let events: any;
  let audit: any;

  const actor = { id: 1, firstName: 'Іван', lastName: 'П', role: 'Employe', appRoles: [] } as any;
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    prisma = {
      workSchedule: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      shiftSwap: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 100 }),
        update: jest.fn().mockResolvedValue({ id: 100 }),
      },
      user: { count: jest.fn().mockResolvedValue(1) },
      department: { findMany: jest.fn().mockResolvedValue([{ id: 10 }]) },
      // approve виконує транзакцію колбеком — прокидаємо той самий мок як tx
      $transaction: jest.fn().mockImplementation((arg) =>
        typeof arg === 'function' ? arg(prisma) : Promise.resolve([]),
      ),
    };
    notifications = { createNotification: jest.fn().mockResolvedValue(null) };
    events = { emitToAll: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new ShiftSwapService(prisma, notifications, events, audit);
  });

  const ownSchedule = (over: any = {}) => ({
    id: 50,
    userId: actor.id,
    isDraft: false,
    isDayOff: false,
    date: future,
    departmentId: 10,
    department: { id: 10, name: 'Почайна' },
    ...over,
  });

  describe('create', () => {
    it('створює відкриту пропозицію на власну зміну', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(ownSchedule());
      const res = await service.create(actor, { scheduleId: 50 });
      expect(prisma.shiftSwap.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.SWAP_CREATED }),
      );
      expect(events.emitToAll).toHaveBeenCalledWith('invalidate_swaps');
      expect(res).toEqual({ id: 100 });
    });

    it('не дозволяє віддавати чужу зміну', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(
        ownSchedule({ userId: 999 }),
      );
      await expect(service.create(actor, { scheduleId: 50 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('чернетку/вихідний/минуле — не можна', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(
        ownSchedule({ isDraft: true }),
      );
      await expect(service.create(actor, { scheduleId: 50 })).rejects.toThrow(
        BadRequestException,
      );

      prisma.workSchedule.findUnique.mockResolvedValue(
        ownSchedule({ isDayOff: true }),
      );
      await expect(service.create(actor, { scheduleId: 50 })).rejects.toThrow(
        BadRequestException,
      );

      prisma.workSchedule.findUnique.mockResolvedValue(
        ownSchedule({ date: new Date('2000-01-01') }),
      );
      await expect(service.create(actor, { scheduleId: 50 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('не дублює активну пропозицію', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(ownSchedule());
      prisma.shiftSwap.findFirst.mockResolvedValue({ id: 7 });
      await expect(service.create(actor, { scheduleId: 50 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('направлена пропозиція: перевіряє членство отримувача', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(ownSchedule());
      prisma.user.count.mockResolvedValue(0);
      await expect(
        service.create(actor, { scheduleId: 50, targetUserId: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('відсутня зміна → NotFound', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(null);
      await expect(service.create(actor, { scheduleId: 50 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('направлена пропозиція сповіщає адресата', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(ownSchedule());
      prisma.user.count.mockResolvedValue(1); // адресат — член відділу
      await service.create(actor, { scheduleId: 50, targetUserId: 2 });
      expect(notifications.createNotification).toHaveBeenCalledWith(
        2,
        expect.any(Object),
      );
    });
  });

  describe('claim', () => {
    const openSwap = (over: any = {}) => ({
      id: 100,
      status: 'OPEN',
      requesterId: 2,
      targetUserId: null,
      scheduleId: 50,
      claimerId: null,
      schedule: { departmentId: 10, date: future, department: { name: 'Почайна' } },
      ...over,
    });

    it('забирає відкриту пропозицію', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(openSwap());
      const res = await service.claim(actor, 100);
      expect(prisma.shiftSwap.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { claimerId: 1, status: 'CLAIMED' },
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.SWAP_CLAIMED }),
      );
      expect(notifications.createNotification).toHaveBeenCalledWith(
        2,
        expect.any(Object),
      );
      expect(res).toEqual({ id: 100 });
    });

    it('не власну і лише OPEN', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(
        openSwap({ status: 'CLAIMED' }),
      );
      await expect(service.claim(actor, 100)).rejects.toThrow(
        BadRequestException,
      );

      prisma.shiftSwap.findUnique.mockResolvedValue(
        openSwap({ requesterId: actor.id }),
      );
      await expect(service.claim(actor, 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('направлену пропозицію може забрати лише адресат', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(
        openSwap({ targetUserId: 999 }),
      );
      await expect(service.claim(actor, 100)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('не член відділення — не можна', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(openSwap());
      prisma.user.count.mockResolvedValue(0);
      await expect(service.claim(actor, 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('конфлікт: уже є зміна того дня', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(openSwap());
      prisma.workSchedule.findFirst.mockResolvedValue({ id: 77 });
      await expect(service.claim(actor, 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('направлену пропозицію забирає адресат', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(
        openSwap({ targetUserId: actor.id }),
      );
      await service.claim(actor, 100);
      expect(prisma.shiftSwap.update).toHaveBeenCalled();
    });
  });

  describe('approve/reject/cancel', () => {
    const claimedSwap = (over: any = {}) => ({
      id: 100,
      status: 'CLAIMED',
      requesterId: 2,
      claimerId: 3,
      scheduleId: 50,
      schedule: { departmentId: 10, date: future, department: { name: 'Почайна' } },
      claimer: { firstName: 'О', lastName: 'К' },
      ...over,
    });

    it('approve відмовляє, якщо у claimer уже зʼявилась зміна того дня', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(claimedSwap());
      prisma.workSchedule.findFirst.mockResolvedValue({ id: 77 });
      await expect(service.approve(actor, 100)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.workSchedule.update).not.toHaveBeenCalled();
    });

    it('approve перекладає unique-конфлікт у 400, а не 500', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(claimedSwap());
      prisma.workSchedule.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.approve(actor, 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('approve переносить зміну і пише аудит', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(claimedSwap());
      await service.approve(actor, 100);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.workSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: 3 } }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.SWAP_APPROVED }),
      );
      expect(events.emitToAll).toHaveBeenCalledWith('invalidate_schedules');
    });

    it('approve лише зі статусу CLAIMED', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(
        claimedSwap({ status: 'OPEN', claimerId: null }),
      );
      await expect(service.approve(actor, 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('reject закриває активну пропозицію', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(claimedSwap());
      await service.reject(actor, 100);
      expect(prisma.shiftSwap.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'REJECTED', resolvedAt: expect.any(Date) } }),
      );
    });

    it('approve без даних claimer у релації (fallback "колезі")', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(
        claimedSwap({ claimer: null }),
      );
      await service.approve(actor, 100);
      expect(prisma.workSchedule.update).toHaveBeenCalled();
    });

    it('reject без claimerId (нема кого додатково сповіщати)', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(
        claimedSwap({ status: 'OPEN', claimerId: null }),
      );
      await service.reject(actor, 100);
      expect(prisma.shiftSwap.update).toHaveBeenCalled();
    });

    it('cancel лише автором', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(
        claimedSwap({ requesterId: 999 }),
      );
      await expect(service.cancel(actor, 100)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('cancel автором закриває пропозицію', async () => {
      prisma.shiftSwap.findUnique.mockResolvedValue(
        claimedSwap({ requesterId: actor.id }),
      );
      await service.cancel(actor, 100);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.SWAP_CANCELLED }),
      );
    });
  });

  describe('list', () => {
    it('повертає доступні/власні/забрані; pendingApproval лише для менеджера', async () => {
      prisma.shiftSwap.findMany = jest.fn().mockResolvedValue([]);
      const res = await service.list(actor);
      expect(res.canManage).toBe(false);
      expect(prisma.shiftSwap.findMany).toHaveBeenCalledTimes(3);
      expect(res).toHaveProperty('available');
      expect(res).toHaveProperty('mine');
      expect(res).toHaveProperty('claimed');
    });
  });
});
