import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkShiftService } from './work.shift.service';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentService } from '../department/department.service';
import { UserService } from '../user/user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';
import { ShiftSessionService } from './shift.session.service';

describe('WorkShiftService', () => {
  let service: WorkShiftService;
  let prisma: any;
  let departmentService: { getDepartmentById: jest.Mock };
  let userService: { getAdmins: jest.Mock };
  let notifications: { createNotification: jest.Mock };
  let events: { emitToUsers: jest.Mock };

  const admin = { id: 1, role: 'Admin' } as any;
  const employee = { id: 3, role: 'Employe' } as any;

  beforeEach(async () => {
    prisma = {
      workShift: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 5 }),
        update: jest.fn().mockResolvedValue({ id: 5, tags: [] }),
        delete: jest.fn().mockResolvedValue({ id: 5 }),
      },
      workSchedule: { findFirst: jest.fn().mockResolvedValue(null) },
      tag: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 99 }),
      },
    };
    departmentService = {
      getDepartmentById: jest.fn().mockResolvedValue({ id: 1 }),
    };
    userService = { getAdmins: jest.fn().mockResolvedValue([1]) };
    notifications = { createNotification: jest.fn() };
    events = { emitToUsers: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        WorkShiftService,
        ShiftSessionService,
        { provide: PrismaService, useValue: prisma },
        { provide: DepartmentService, useValue: departmentService },
        { provide: UserService, useValue: userService },
        { provide: NotificationsService, useValue: notifications },
        { provide: EventsGateway, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(WorkShiftService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getWorkShifts', () => {
    it('адмін фільтрує за всіма параметрами', async () => {
      prisma.workShift.findMany.mockResolvedValue([{ id: 1 }]);
      const res = await service.getWorkShifts(admin, {
        id: 1,
        userId: 2,
        departmentId: 1,
        status: 'PENDING',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
        tagIds: [1],
      } as any);
      expect(res).toEqual([{ id: 1 }]);
      expect(prisma.workShift.findMany).toHaveBeenCalled();
    });

    it('працівник бачить лише власні зміни', async () => {
      await service.getWorkShifts(employee, {} as any);
      const arg = prisma.workShift.findMany.mock.calls[0][0];
      expect(arg.where.userId).toBe(3);
    });
  });

  describe('getWorkShiftById', () => {
    it('кидає NotFound, якщо зміну не знайдено', async () => {
      prisma.workShift.findUnique.mockResolvedValue(null);
      await expect(service.getWorkShiftById(1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createWorkShift', () => {
    const baseDto = {
      date: '2026-06-01',
      departmentId: 1,
      userId: 2,
      startedAt: '09:00',
      endTime: '18:00',
    } as any;

    it('кидає помилку, якщо кінець раніше за початок', async () => {
      await expect(
        service.createWorkShift(admin, {
          ...baseDto,
          startedAt: '18:00',
          endTime: '09:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('кидає помилку при перетині змін', async () => {
      prisma.workShift.findMany.mockResolvedValue([
        { id: 10, date: new Date(2026, 5, 1), startedAt: '09:00', endTime: '18:00' },
      ]);
      await expect(
        service.createWorkShift(admin, {
          ...baseDto,
          startedAt: '10:00',
          endTime: '12:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('виявляє перетин, коли кінець нової потрапляє в існуючу', async () => {
      prisma.workShift.findMany.mockResolvedValue([
        { id: 10, date: new Date(2026, 5, 1), startedAt: '09:00', endTime: '18:00' },
      ]);
      await expect(
        service.createWorkShift(admin, {
          ...baseDto,
          startedAt: '07:00',
          endTime: '10:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('виявляє перетин, коли нова повністю охоплює існуючу', async () => {
      prisma.workShift.findMany.mockResolvedValue([
        { id: 10, date: new Date(2026, 5, 1), startedAt: '09:00', endTime: '18:00' },
      ]);
      await expect(
        service.createWorkShift(admin, {
          ...baseDto,
          startedAt: '08:00',
          endTime: '19:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('адмін створює підтверджену зміну (тег "Поза графіком")', async () => {
      prisma.workShift.create.mockResolvedValue({ id: 5, status: 'APPROVED' });
      const res = await service.createWorkShift(admin, baseDto);
      expect(prisma.workShift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED', totalHours: 9 }),
        }),
      );
      expect(events.emitToUsers).toHaveBeenCalled();
      expect(res).toEqual({ id: 5, status: 'APPROVED' });
    });

    it('працівник створює зміну зі статусом PENDING', async () => {
      await service.createWorkShift(employee, baseDto);
      expect(prisma.workShift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('додає тег "У вихідний", якщо в розкладі вихідний', async () => {
      prisma.workSchedule.findFirst.mockResolvedValue({ isDayOff: true });
      prisma.tag.findUnique.mockResolvedValue({ id: 50 });
      await service.createWorkShift(admin, baseDto);
      expect(prisma.tag.findUnique).toHaveBeenCalledWith({
        where: { name: 'У вихідний' },
      });
    });

    it('додає тег "Запізнення" при пізнішому початку', async () => {
      prisma.workSchedule.findFirst.mockResolvedValue({
        isDayOff: false,
        startedAt: '08:00',
      });
      prisma.tag.findUnique.mockResolvedValue({ id: 60 });
      await service.createWorkShift(admin, baseDto);
      expect(prisma.tag.findUnique).toHaveBeenCalledWith({
        where: { name: 'Запізнення' },
      });
    });

    it('не додає тег запізнення, якщо вчасно', async () => {
      prisma.workSchedule.findFirst.mockResolvedValue({
        isDayOff: false,
        startedAt: '10:00',
      });
      await service.createWorkShift(admin, baseDto);
      expect(prisma.tag.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateWorkShiftDto', () => {
    const existing = {
      id: 1,
      userId: 2,
      status: 'PENDING',
      startedAt: '09:00',
      endTime: '18:00',
      departmentId: 1,
      date: new Date(2026, 5, 1),
    };

    it('забороняє редагувати чужу зміну', async () => {
      prisma.workShift.findUnique.mockResolvedValue(existing);
      await expect(
        service.updateWorkShiftDto(1, {} as any, employee),
      ).rejects.toThrow(ForbiddenException);
    });

    it('забороняє редагувати підтверджену зміну', async () => {
      prisma.workShift.findUnique.mockResolvedValue({
        ...existing,
        userId: 3,
        status: 'APPROVED',
      });
      await expect(
        service.updateWorkShiftDto(1, { startedAt: '10:00' } as any, employee),
      ).rejects.toThrow(ForbiddenException);
    });

    it('кидає BadRequest, якщо дані не змінились', async () => {
      prisma.workShift.findUnique.mockResolvedValue({ ...existing, userId: 1 });
      await expect(
        service.updateWorkShiftDto(1, {} as any, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it('адмін підтверджує зміну і сповіщає власника', async () => {
      prisma.workShift.findUnique.mockResolvedValue(existing);
      await service.updateWorkShiftDto(1, { status: 'APPROVED' } as any, admin);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ title: 'Зміну підтверджено' }),
      );
    });

    it('адмін відхиляє зміну', async () => {
      prisma.workShift.findUnique.mockResolvedValue(existing);
      await service.updateWorkShiftDto(1, { status: 'REJECTED' } as any, admin);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ title: 'Зміну відхилено' }),
      );
    });

    it('адмін оновлює чужу зміну без зміни статусу', async () => {
      prisma.workShift.findUnique.mockResolvedValue(existing);
      await service.updateWorkShiftDto(1, { startedAt: '10:00' } as any, admin);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ title: 'Зміну оновлено' }),
      );
    });

    it('власник редагує відхилену зміну — статус стає PENDING, без сповіщення', async () => {
      prisma.workShift.findUnique.mockResolvedValue({
        ...existing,
        status: 'REJECTED',
      });
      const owner = { id: 2, role: 'Employe' } as any;
      await service.updateWorkShiftDto(1, { startedAt: '10:00' } as any, owner);
      expect(prisma.workShift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
      expect(notifications.createNotification).not.toHaveBeenCalled();
    });

    it('перевіряє підрозділ і оновлює теги', async () => {
      prisma.workShift.findUnique.mockResolvedValue({ ...existing, userId: 1 });
      await service.updateWorkShiftDto(
        1,
        { departmentId: 2, tagIds: [5] } as any,
        admin,
      );
      expect(departmentService.getDepartmentById).toHaveBeenCalledWith(2);
      expect(prisma.workShift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: { set: [{ id: 5 }] },
          }),
        }),
      );
    });

    it('кидає помилку, якщо кінець раніше за початок', async () => {
      prisma.workShift.findUnique.mockResolvedValue({ ...existing, userId: 1 });
      await expect(
        service.updateWorkShiftDto(
          1,
          { startedAt: '18:00', endTime: '09:00' } as any,
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('оновлює лише теги, без зміни інших полів', async () => {
      prisma.workShift.findUnique.mockResolvedValue({ ...existing, userId: 1 });
      await service.updateWorkShiftDto(1, { tagIds: [7] } as any, admin);
      expect(prisma.workShift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tags: { set: [{ id: 7 }] } }),
        }),
      );
    });

    it('не вважає перетином ту саму зміну при оновленні', async () => {
      prisma.workShift.findUnique.mockResolvedValue({ ...existing, userId: 1 });
      prisma.workShift.findMany.mockResolvedValue([
        { id: 1, date: existing.date, startedAt: '09:00', endTime: '18:00' },
      ]);
      await service.updateWorkShiftDto(1, { startedAt: '10:00' } as any, admin);
      expect(prisma.workShift.update).toHaveBeenCalled();
    });
  });

  describe('deleteShift', () => {
    const existing = {
      id: 5,
      userId: 2,
      status: 'PENDING',
      date: new Date(2026, 5, 1),
      user: { id: 2, firstName: 'Іван' },
    };

    it('забороняє видаляти чужу зміну', async () => {
      prisma.workShift.findUnique.mockResolvedValue(existing);
      await expect(service.deleteShift(employee, 5)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('забороняє працівнику видаляти підтверджену зміну', async () => {
      prisma.workShift.findUnique.mockResolvedValue({
        ...existing,
        userId: 3,
        status: 'APPROVED',
        user: { id: 3, firstName: 'П' },
      });
      await expect(service.deleteShift(employee, 5)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('адмін видаляє зміну і сповіщає власника', async () => {
      prisma.workShift.findUnique.mockResolvedValue(existing);
      await service.deleteShift(admin, 5);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ title: 'Зміну видалено' }),
      );
      expect(prisma.workShift.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('власник видаляє власну зміну без сповіщення', async () => {
      prisma.workShift.findUnique.mockResolvedValue(existing);
      const owner = { id: 2, role: 'Employe' } as any;
      await service.deleteShift(owner, 5);
      expect(notifications.createNotification).not.toHaveBeenCalled();
      expect(prisma.workShift.delete).toHaveBeenCalled();
    });
  });
});
