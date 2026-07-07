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

describe('WorkScheduleService', () => {
  let service: WorkScheduleService;
  let prisma: any;
  let departmentService: { getDepartmentById: jest.Mock };
  let userService: { findById: jest.Mock };
  let events: { server: { emit: jest.Mock } };

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
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
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
      ],
    }).compile();

    service = moduleRef.get(WorkScheduleService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getWorkSchedules', () => {
    it('повертає графіки за фільтром', async () => {
      prisma.workSchedule.findMany.mockResolvedValue([{ id: 1 }]);
      const res = await service.getWorkSchedules({
        userId: 2,
        departmentId: 1,
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
      } as any);
      expect(res).toEqual([{ id: 1 }]);
    });

    it('повертає всі графіки без фільтра', async () => {
      await service.getWorkSchedules({} as any);
      expect(prisma.workSchedule.findMany).toHaveBeenCalled();
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
