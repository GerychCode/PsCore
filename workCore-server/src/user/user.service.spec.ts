import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file.storage/file.starage.service';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let prisma: any;
  let redis: any;
  let fileStorage: { deleteFile: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workShift: { findMany: jest.fn() },
    };
    redis = { set: jest.fn() };
    fileStorage = { deleteFile: jest.fn() };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: FileStorageService, useValue: fileStorage },
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = moduleRef.get(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateTelegramCode', () => {
    it('генерує 6-значний код і зберігає в Redis на 300с', async () => {
      const code = await service.generateTelegramCode(42);
      expect(code).toMatch(/^\d{6}$/);
      expect(redis.set).toHaveBeenCalledWith(
        `telegram-code:${code}`,
        42,
        'EX',
        300,
      );
    });
  });

  describe('findAllUsers', () => {
    it('повертає список користувачів', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 1 }]);
      await expect(service.findAllUsers()).resolves.toEqual([{ id: 1 }]);
    });
  });

  describe('findById', () => {
    it('кидає NotFound, якщо користувача немає', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById(1)).rejects.toThrow(NotFoundException);
    });

    it('повертає DTO без хешу пароля', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'a@a.com',
        passwordHash: 'secret',
      });
      const res = await service.findById(1);
      expect(res.id).toBe(1);
      expect((res as any).passwordHash).toBeUndefined();
    });
  });

  describe('findByEmail', () => {
    it('шукає користувача за поштою', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      await expect(service.findByEmail('a@a.com')).resolves.toEqual({ id: 1 });
    });
  });

  describe('create', () => {
    it('хешує пароль і створює користувача з датою народження', async () => {
      prisma.user.create.mockResolvedValue({ id: 1 });
      await service.create({
        firstName: 'A',
        lastName: 'B',
        email: 'a@a.com',
        password: 'secret',
        dateOfBirth: '2000-01-01',
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('secret', 10);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: 'hashed' }),
        }),
      );
    });

    it('створює користувача без пароля та дати народження', async () => {
      prisma.user.create.mockResolvedValue({ id: 2 });
      await service.create({
        firstName: 'A',
        lastName: 'B',
        email: 'c@a.com',
        password: '',
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: '', dateOfBirth: null }),
        }),
      );
    });
  });

  describe('updateUser', () => {
    it('кидає BadRequest для порожнього DTO', async () => {
      await expect(service.updateUser({} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('кидає NotFound, якщо користувача не знайдено за id', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateUser({ firstName: 'X' } as any, 5),
      ).rejects.toThrow(NotFoundException);
    });

    it('оновлює користувача за id (адмінський виклик)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 5, firstName: 'A' });
      prisma.user.update.mockResolvedValue({ id: 5, firstName: 'X' });
      await service.updateUser({ firstName: 'X' } as any, 5);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: { firstName: 'X' },
        }),
      );
    });

    it('кидає BadRequest, якщо дані ідентичні поточним', async () => {
      const user = { id: 1, firstName: 'A' } as any;
      await expect(
        service.updateUser({ firstName: 'A' } as any, undefined, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('оновлює змінені поля', async () => {
      const user = { id: 1, firstName: 'A' } as any;
      prisma.user.update.mockResolvedValue({ id: 1, firstName: 'B' });
      const res = await service.updateUser(
        { firstName: 'B' } as any,
        undefined,
        user,
      );
      expect(prisma.user.update).toHaveBeenCalled();
      expect(res.firstName).toBe('B');
    });
  });

  describe('destroyUser', () => {
    it('забороняє видаляти самого себе', async () => {
      await expect(service.destroyUser(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('кидає NotFound, якщо цільового користувача немає', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.destroyUser(1, 2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('видаляє користувача та повертає статус OK', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 2 });
      prisma.user.delete.mockResolvedValue({});
      const res = await service.destroyUser(1, 2);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(res).toBe(HttpStatus.OK);
    });
  });

  describe('destroySelf', () => {
    it('кидає NotFound, якщо користувача немає', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.destroySelf(1, { password: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('кидає BadRequest при невірному паролі', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: 'h' });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(false);
      await expect(
        service.destroySelf(1, { password: 'x' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('видаляє власний акаунт при вірному паролі', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: 'h' });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      prisma.user.delete.mockResolvedValue({});
      const res = await service.destroySelf(1, { password: 'x' } as any);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res).toBe(HttpStatus.OK);
    });
  });

  describe('saveAvatarToDB', () => {
    it('оновлює аватар і видаляє старий файл', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, avatar: 'new.png' });
      await service.saveAvatarToDB(
        { id: 1, avatar: 'old.png' } as any,
        { filename: 'new.png' } as any,
      );
      expect(fileStorage.deleteFile).toHaveBeenCalledWith('old.png');
    });

    it('не видаляє файл, якщо старого аватара не було', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, avatar: 'new.png' });
      await service.saveAvatarToDB(
        { id: 1, avatar: '' } as any,
        { filename: 'new.png' } as any,
      );
      expect(fileStorage.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('getAdmins', () => {
    it('повертає масив id адміністраторів', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await expect(service.getAdmins()).resolves.toEqual([1, 2]);
    });
  });

  describe('getUserStatistics', () => {
    it('кидає NotFound, якщо користувача немає', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserStatistics(1, 6, 2026)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('агрегує години, зміни, понаднормові та теги', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findMany.mockResolvedValue([
        {
          date: new Date(2026, 5, 1),
          totalHours: 100,
          tags: [{ name: 'Звичайна' }],
        },
        { date: new Date(2026, 5, 2), totalHours: 90, tags: [] },
      ]);
      const stats = await service.getUserStatistics(1, 6, 2026);
      expect(stats.totalShifts).toBe(2);
      expect(stats.totalHours).toBe(190);
      expect(stats.overtimeHours).toBe(14);
      expect(stats.dailyHours).toHaveLength(2);
      expect(stats.tagDistribution).toEqual(
        expect.arrayContaining([
          { name: 'Звичайна', value: 100 },
          { name: 'Без тегу', value: 90 },
        ]),
      );
    });

    it('коректно агрегує зміни того ж дня й тегу та без годин', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findMany.mockResolvedValue([
        { date: new Date(2026, 5, 1), totalHours: 5, tags: [{ name: 'A' }] },
        { date: new Date(2026, 5, 1), totalHours: undefined, tags: [{ name: 'A' }] },
      ]);
      const stats = await service.getUserStatistics(1, 6, 2026);
      expect(stats.dailyHours).toHaveLength(1);
      expect(stats.tagDistribution).toEqual([{ name: 'A', value: 5 }]);
    });

    it('понаднормові = 0, якщо годин менше за норму', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findMany.mockResolvedValue([
        { date: new Date(2026, 5, 1), totalHours: 50, tags: [] },
      ]);
      const stats = await service.getUserStatistics(1, 6, 2026);
      expect(stats.overtimeHours).toBe(0);
    });
  });
});
