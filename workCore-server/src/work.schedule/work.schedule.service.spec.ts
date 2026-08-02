import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkScheduleService } from './work.schedule.service';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentService } from '../department/department.service';
import { UserService } from '../user/user.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '../../generated/prisma';

describe('WorkScheduleService', () => {
  let service: WorkScheduleService;
  let prisma: any;
  let departmentService: { getDepartmentById: jest.Mock };
  let userService: { findById: jest.Mock };
  let events: { server: { emit: jest.Mock } };
  let notifications: { createNotification: jest.Mock };

  const admin = { id: 1, role: 'Admin' } as any;
  const employee = { id: 2, role: 'Employe' } as any;

  const existing = {
    id: 1,
    userId: 2,
    departmentId: 1,
    date: new Date(2026, 5, 1),
    startedAt: '09:00',
    endTime: '18:00',
  };

  beforeEach(async () => {
    prisma = {
      workSchedule: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workScheduleLock: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      // count — перевірка членства у відділенні; за замовчуванням "член є"
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
      },
      shiftSwap: { findMany: jest.fn().mockResolvedValue([]) },
    };
    notifications = { createNotification: jest.fn().mockResolvedValue(null) };
    departmentService = {
      getDepartmentById: jest.fn().mockResolvedValue({ id: 1 }),
    };
    userService = { findById: jest.fn().mockResolvedValue({ id: 2 }) };
    events = { server: { emit: jest.fn() } };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        WorkScheduleService,
        { provide: PrismaService, useValue: prisma },
        { provide: DepartmentService, useValue: departmentService },
        { provide: UserService, useValue: userService },
        { provide: EventsGateway, useValue: events },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(WorkScheduleService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getWorkSchedules', () => {
    it('повертає графіки за фільтром', async () => {
      prisma.workSchedule.findMany.mockResolvedValue([{ id: 1 }]);
      const res = await service.getWorkSchedules(admin, {
        userId: 2,
        departmentId: 1,
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
      } as any);
      expect(res).toEqual([{ id: 1 }]);
    });

    it('повертає всі графіки без фільтра', async () => {
      await service.getWorkSchedules(admin, {} as any);
      expect(prisma.workSchedule.findMany).toHaveBeenCalled();
    });

    it('працівнику віддає лише його опубліковані рядки', async () => {
      await service.getWorkSchedules(employee, { userId: 999 } as any);
      expect(prisma.workSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: employee.id,
            isDraft: false,
          }),
        }),
      );
    });
  });

  describe('захист від перепризначення і обходу замка', () => {
    beforeEach(() => {
      prisma.workSchedule.findUnique.mockResolvedValue(existing);
      prisma.workSchedule.update.mockResolvedValue(existing);
    });

    it('працівник не може перекинути свою зміну іншому (userId)', async () => {
      await expect(
        service.updateWorkSchedule(employee, 1, { userId: 7 } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workSchedule.update).not.toHaveBeenCalled();
    });

    it('працівник не може перенести зміну в інше відділення', async () => {
      await expect(
        service.updateWorkSchedule(employee, 1, { departmentId: 9 } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('менеджеру перепризначення дозволено', async () => {
      await service.updateWorkSchedule(admin, 1, { userId: 7 } as any);
      expect(prisma.workSchedule.update).toHaveBeenCalled();
    });

    it('замок тижня-джерела не обходиться зміною дати', async () => {
      // вільний тиждень-призначення, залочений тиждень-джерело
      prisma.workScheduleLock.findUnique
        .mockResolvedValueOnce({ isLocked: true })
        .mockResolvedValueOnce(null);
      await expect(
        service.updateWorkSchedule(employee, 1, {
          date: '2026-06-15',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('створення в чужому відділенні заборонено працівнику', async () => {
      prisma.user.count.mockResolvedValue(0);
      await expect(
        service.createWorkSchedule(employee, {
          date: '2026-06-01',
          departmentId: 99,
          userId: employee.id,
          startedAt: '09:00',
          endTime: '18:00',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('видалення з активним обміном', () => {
    it('попереджає учасників пропозиції перед видаленням', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(existing);
      prisma.workSchedule.delete.mockResolvedValue(existing);
      prisma.shiftSwap.findMany.mockResolvedValue([
        { requesterId: 2, claimerId: 3 },
      ]);

      await service.deleteWorkSchedule(admin, 1);

      // актор (admin, id=1) себе не сповіщає; решта — так
      expect(notifications.createNotification).toHaveBeenCalledTimes(2);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ title: 'Обмін скасовано' }),
      );
    });
  });

  describe('getWorkScheduleById', () => {
    it('кидає NotFound, якщо розклад не знайдено', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(null);
      await expect(service.getWorkScheduleById(1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createWorkSchedule', () => {
    const baseDto = {
      date: '2026-06-01',
      departmentId: 1,
      userId: 2,
      startedAt: '09:00',
      endTime: '18:00',
    } as any;

    it('забороняє працівнику створювати графік іншому', async () => {
      await expect(
        service.createWorkSchedule(employee, { ...baseDto, userId: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('кидає помилку, якщо тиждень заблоковано для працівника', async () => {
      prisma.workScheduleLock.findUnique.mockResolvedValue({ isLocked: true });
      await expect(
        service.createWorkSchedule(employee, baseDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('кидає помилку, якщо кінець раніше за початок', async () => {
      await expect(
        service.createWorkSchedule(admin, {
          ...baseDto,
          startedAt: '18:00',
          endTime: '09:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('кидає помилку, якщо на день уже є розклад', async () => {
      prisma.workSchedule.findFirst.mockResolvedValue({ id: 1 });
      await expect(service.createWorkSchedule(admin, baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('створює розклад і сповіщає клієнтів', async () => {
      prisma.workSchedule.create.mockResolvedValue({ id: 7 });
      const res = await service.createWorkSchedule(admin, baseDto);
      expect(events.server.emit).toHaveBeenCalledWith('invalidate_schedules');
      expect(res).toEqual({ id: 7 });
    });

    it('нормалізує дату до початку дня', async () => {
      prisma.workSchedule.create.mockResolvedValue({ id: 7 });
      await service.createWorkSchedule(admin, baseDto);
      const arg = prisma.workSchedule.create.mock.calls[0][0];
      const d: Date = arg.data.date;
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
    });

    it('гонка unique(userId,date) → BadRequest замість 500', async () => {
      prisma.workSchedule.findFirst.mockResolvedValue(null);
      prisma.workSchedule.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '6.9.0',
        }),
      );
      await expect(service.createWorkSchedule(admin, baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateWorkSchedule', () => {
    it('забороняє редагувати чужий графік', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue({
        ...existing,
        userId: 99,
      });
      await expect(
        service.updateWorkSchedule(employee, 1, {} as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('кидає помилку при конфлікті розкладу на день', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(existing);
      prisma.workSchedule.findFirst.mockResolvedValue({ id: 2 });
      await expect(
        service.updateWorkSchedule(admin, 1, { date: '2026-06-02' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('кидає помилку при некоректному часі', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(existing);
      await expect(
        service.updateWorkSchedule(admin, 1, {
          startedAt: '18:00',
          endTime: '09:00',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('оновлює графік (зі зміною підрозділу й дати)', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(existing);
      prisma.workSchedule.update.mockResolvedValue({ id: 1 });
      await service.updateWorkSchedule(admin, 1, {
        departmentId: 2,
        date: '2026-06-02',
      } as any);
      expect(departmentService.getDepartmentById).toHaveBeenCalledWith(2);
      expect(prisma.workSchedule.update).toHaveBeenCalled();
      expect(events.server.emit).toHaveBeenCalledWith('invalidate_schedules');
    });
  });

  describe('deleteWorkSchedule', () => {
    it('забороняє видаляти чужий графік', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue({
        ...existing,
        userId: 99,
      });
      await expect(service.deleteWorkSchedule(employee, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('адмін видаляє графік', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(existing);
      prisma.workSchedule.delete.mockResolvedValue({ id: 1 });
      await service.deleteWorkSchedule(admin, 1);
      expect(prisma.workSchedule.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(events.server.emit).toHaveBeenCalledWith('invalidate_schedules');
    });
  });

  describe('toggleWeekLock', () => {
    it('робить upsert блокування і сповіщає клієнтів', async () => {
      prisma.workScheduleLock.upsert.mockResolvedValue({
        id: 1,
        isLocked: true,
      });
      const res = await service.toggleWeekLock({
        date: '2026-06-01',
        departmentId: 1,
        isLocked: true,
      } as any);
      expect(prisma.workScheduleLock.upsert).toHaveBeenCalled();
      expect(events.server.emit).toHaveBeenCalledWith('invalidate_schedules');
      expect(res).toEqual({ id: 1, isLocked: true });
    });
  });

  describe('гілки помилок і адмін-перегляд', () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '6.9.0',
    });

    it('update: P2002 → BadRequest', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(existing);
      prisma.workSchedule.findFirst.mockResolvedValue(null);
      prisma.workSchedule.update.mockRejectedValue(p2002);
      await expect(
        service.updateWorkSchedule(admin, 1, { startedAt: '10:00' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('update: інша помилка прокидається далі', async () => {
      prisma.workSchedule.findUnique.mockResolvedValue(existing);
      prisma.workSchedule.update.mockRejectedValue(new Error('db'));
      await expect(
        service.updateWorkSchedule(admin, 1, { startedAt: '10:00' } as any),
      ).rejects.toThrow('db');
    });

    it('create: інша помилка прокидається далі', async () => {
      prisma.workSchedule.findFirst.mockResolvedValue(null);
      prisma.workSchedule.create.mockRejectedValue(new Error('db'));
      await expect(
        service.createWorkSchedule(admin, {
          date: '2026-06-01',
          departmentId: 1,
          userId: 2,
          startedAt: '09:00',
          endTime: '18:00',
        } as any),
      ).rejects.toThrow('db');
    });

    it('getWeekView (адмін) позначає порушені побажання', async () => {
      prisma.department.findMany.mockResolvedValue([{ id: 1, name: 'A' }]);
      prisma.user.findMany.mockResolvedValue([
        { id: 2, firstName: 'X', lastName: 'Y' },
      ]);
      prisma.workSchedule.findMany.mockResolvedValue([
        {
          id: 10,
          userId: 2,
          departmentId: 1,
          date: new Date(2026, 5, 3),
          startedAt: '09:00',
          endTime: '18:00',
          isDayOff: false,
          isDraft: true,
        },
      ]);
      prisma.workScheduleLock.findMany.mockResolvedValue([]);
      prisma.scheduleWish = {
        findMany: jest.fn().mockResolvedValue([
          { userId: 2, date: new Date(2026, 5, 3) },
        ]),
      };
      const res = await service.getWeekView('2026-06-03T12:00:00', true);
      const cell = res[0].users[0].schedule.find(
        (s: any) => s && s.wishViolated,
      );
      expect(cell).toBeDefined();
    });
  });

  describe('getWeekView', () => {
    it('формує тижневий перегляд із розкладами та блокуваннями', async () => {
      prisma.department.findMany.mockResolvedValue([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 2, firstName: 'X', lastName: 'Y' },
      ]);
      prisma.workSchedule.findMany.mockResolvedValue([
        {
          id: 10,
          userId: 2,
          departmentId: 1,
          date: new Date(2026, 5, 3, 12),
          startedAt: '09:00',
          endTime: '18:00',
          isDayOff: false,
        },
      ]);
      prisma.workScheduleLock.findMany.mockResolvedValue([
        { departmentId: 1, isLocked: true },
      ]);

      const result = await service.getWeekView('2026-06-03T12:00:00');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({ departmentId: 1, isLocked: true }),
      );
      expect(result[0].users).toHaveLength(1);
      expect(result[1].isLocked).toBe(false);
      expect(result[1].users).toHaveLength(0);
    });
  });
});
