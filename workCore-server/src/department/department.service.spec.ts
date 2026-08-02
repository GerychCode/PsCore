import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let prisma: any;

  const validDto = {
    name: 'Центральне',
    weekdaysOpeningTime: '09:00',
    weekdaysClosingTime: '18:00',
    weekendsOpeningTime: '10:00',
    weekendsClosingTime: '16:00',
  } as any;

  const existing = {
    id: 1,
    ...validDto,
  };

  beforeEach(async () => {
    prisma = {
      department: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workSchedule: { deleteMany: jest.fn() },
      workShift: { deleteMany: jest.fn() },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DepartmentService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getAllDepartments', () => {
    it('повертає всі відділення', async () => {
      prisma.department.findMany.mockResolvedValue([{ id: 1 }]);
      await expect(service.getAllDepartments()).resolves.toEqual([{ id: 1 }]);
    });
  });

  describe('getDepartmentById', () => {
    it('кидає NotFound, якщо відділення не існує', async () => {
      prisma.department.findUnique.mockResolvedValue(null);
      await expect(service.getDepartmentById(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('повертає відділення', async () => {
      prisma.department.findUnique.mockResolvedValue(existing);
      await expect(service.getDepartmentById(1)).resolves.toEqual(existing);
    });
  });

  describe('createDepartment', () => {
    it('кидає помилку, якщо назва вже зайнята', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 1 });
      await expect(service.createDepartment(validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('кидає помилку при некоректному діапазоні часу', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      await expect(
        service.createDepartment({
          ...validDto,
          weekdaysOpeningTime: '20:00',
          weekdaysClosingTime: '18:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('створює відділення з валідними даними', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.department.create.mockResolvedValue({ id: 10, ...validDto });
      const res = await service.createDepartment(validDto);
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: { ...validDto },
      });
      expect(res.id).toBe(10);
    });
  });

  describe('updateDepartment', () => {
    it('кидає BadRequest для порожнього DTO', async () => {
      await expect(service.updateDepartment(1, {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('кидає помилку, якщо нова назва вже зайнята', async () => {
      prisma.department.findUnique.mockResolvedValue(existing);
      prisma.department.findFirst.mockResolvedValue({ id: 2 });
      await expect(
        service.updateDepartment(1, { name: 'Інше' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('кидає помилку при некоректному часі', async () => {
      prisma.department.findUnique.mockResolvedValue(existing);
      await expect(
        service.updateDepartment(1, { weekdaysClosingTime: '08:00' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('кидає помилку, якщо дані ідентичні поточним', async () => {
      prisma.department.findUnique.mockResolvedValue(existing);
      await expect(
        service.updateDepartment(1, { weekdaysOpeningTime: '09:00' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('оновлює змінені поля', async () => {
      prisma.department.findUnique.mockResolvedValue(existing);
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.department.update.mockResolvedValue({ id: 1, name: 'Нове' });
      const res = await service.updateDepartment(1, { name: 'Нове' } as any);
      expect(prisma.department.update).toHaveBeenCalled();
      expect(res.name).toBe('Нове');
    });
  });

  describe('deleteDepartment', () => {
    it('видаляє повʼязані графіки, зміни та саме відділення', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 3 });
      prisma.department.delete.mockResolvedValue({ id: 3 });
      await service.deleteDepartment(3);
      expect(prisma.workSchedule.deleteMany).toHaveBeenCalledWith({
        where: { departmentId: 3 },
      });
      expect(prisma.workShift.deleteMany).toHaveBeenCalledWith({
        where: { departmentId: 3 },
      });
      expect(prisma.department.delete).toHaveBeenCalledWith({
        where: { id: 3 },
      });
    });
  });

  describe('validateStaffing (через createDepartment)', () => {
    beforeEach(() => prisma.department.findFirst.mockResolvedValue(null));

    it('валідний штат — ок', async () => {
      prisma.department.create.mockResolvedValue({ id: 1 });
      await expect(
        service.createDepartment({
          ...validDto,
          staffingByWeekday: { '1': 3, '7': 1 },
        }),
      ).resolves.toBeDefined();
    });

    it('невірний день тижня → BadRequest', async () => {
      await expect(
        service.createDepartment({
          ...validDto,
          staffingByWeekday: { '9': 3 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('невірна кількість → BadRequest', async () => {
      await expect(
        service.createDepartment({
          ...validDto,
          staffingByWeekday: { '1': 999 },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMembers / setMembers', () => {
    beforeEach(() => {
      prisma.user = {
        findMany: jest.fn().mockResolvedValue([{ id: 2, firstName: 'X' }]),
        count: jest.fn(),
      };
    });

    it('getMembers повертає склад відділу', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 1 });
      await expect(service.getMembers(1)).resolves.toEqual([
        { id: 2, firstName: 'X' },
      ]);
    });

    it('setMembers: неіснуючі id → BadRequest', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 1 });
      prisma.user.count.mockResolvedValue(1); // передали 2, знайшли 1
      await expect(service.setMembers(1, [2, 999])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('setMembers: оновлює склад', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 1 });
      prisma.user.count.mockResolvedValue(2);
      prisma.department.update = jest.fn().mockResolvedValue({});
      await service.setMembers(1, [2, 3]);
      expect(prisma.department.update).toHaveBeenCalled();
    });

    it('setMembers: порожній список — без count-перевірки', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 1 });
      prisma.department.update = jest.fn().mockResolvedValue({});
      await service.setMembers(1, []);
      expect(prisma.department.update).toHaveBeenCalled();
    });
  });
});
