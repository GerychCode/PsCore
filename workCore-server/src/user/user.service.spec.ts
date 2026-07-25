import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file.storage/file.starage.service';
import { AuditService } from '../audit/audit.service';

jest.mock('bcrypt');

// Мінімальний валідний PNG-заголовок для перевірки магічних байтів
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00,
]);

function makeTempImage(): string {
  const p = path.join(os.tmpdir(), `avatar-test-${Date.now()}.png`);
  fs.writeFileSync(p, PNG_HEADER);
  return p;
}

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
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
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
      expect(bcrypt.hash).toHaveBeenCalledWith('secret', 12);
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
      const tmp = makeTempImage();
      prisma.user.update.mockResolvedValue({ id: 1, avatar: 'new.png' });
      await service.saveAvatarToDB(
        { id: 1, avatar: 'old.png' } as any,
        { filename: 'new.png', path: tmp } as any,
      );
      expect(fileStorage.deleteFile).toHaveBeenCalledWith('old.png');
      fs.rmSync(tmp, { force: true });
    });

    it('не видаляє файл, якщо старого аватара не було', async () => {
      const tmp = makeTempImage();
      prisma.user.update.mockResolvedValue({ id: 1, avatar: 'new.png' });
      await service.saveAvatarToDB(
        { id: 1, avatar: '' } as any,
        { filename: 'new.png', path: tmp } as any,
      );
      expect(fileStorage.deleteFile).not.toHaveBeenCalled();
      fs.rmSync(tmp, { force: true });
    });

    it('відхиляє файл, що не є зображенням (магічні байти)', async () => {
      const p = path.join(os.tmpdir(), `notimg-${Date.now()}.png`);
      fs.writeFileSync(p, Buffer.from('<html>not an image</html>'));
      prisma.user.update.mockResolvedValue({ id: 1, avatar: 'new.png' });
      await expect(
        service.saveAvatarToDB(
          { id: 1, avatar: '' } as any,
          { filename: 'new.png', path: p } as any,
        ),
      ).rejects.toThrow(BadRequestException);
      // невалідний файл має бути видалений
      expect(fileStorage.deleteFile).toHaveBeenCalledWith('new.png');
      fs.rmSync(p, { force: true });
    });
  });

  describe('методи, покриті додатково', () => {
    it('generateTelegramCode кладе код у Redis', async () => {
      const code = await service.generateTelegramCode(5);
      expect(code).toMatch(/^\d{6}$/);
      expect(redis.set).toHaveBeenCalled();
    });

    it('findByIdWithRoles: знайдено (без passwordHash) / не знайдено', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: 'secret',
        appRoles: [],
      });
      const safe: any = await service.findByIdWithRoles(1);
      expect(safe.passwordHash).toBeUndefined();

      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findByIdWithRoles(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('findById кидає NotFound', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById(1)).rejects.toThrow(NotFoundException);
    });

    it('markEmailVerified / clearMustChangePassword / updatePassword → update', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.markEmailVerified(1);
      await service.clearMustChangePassword(1);
      await service.updatePassword(1, 'NewPass1');
      expect(prisma.user.update).toHaveBeenCalledTimes(3);
    });

    it('create без пароля лишає порожній хеш', async () => {
      prisma.user.create.mockResolvedValue({ id: 1 });
      await service.create({
        firstName: 'І',
        lastName: 'П',
        email: 'a@a.com',
        password: '',
      } as any);
      const arg = prisma.user.create.mock.calls[0][0];
      expect(arg.data.passwordHash).toBe('');
    });

    it('notification prefs: get і update', async () => {
      prisma.user.findUnique.mockResolvedValue({ notificationPrefs: null });
      prisma.user.update.mockResolvedValue({});
      await service.updateNotificationPrefs(1, { shift: { web: false } });
      expect(prisma.user.update).toHaveBeenCalled();
      const prefs = await service.getNotificationPrefs(1);
      expect(prefs).toHaveProperty('shift');
    });

    it('getNotificationPrefs коли користувача нема → дефолти', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getNotificationPrefs(99)).resolves.toHaveProperty(
        'shift',
      );
    });

    it('updateUser: змішані зміни (частина полів однакова)', async () => {
      prisma.user.update.mockResolvedValue({ id: 1 });
      await service.updateUser(
        { firstName: 'Same', lastName: 'New' } as any,
        undefined,
        { id: 1, firstName: 'Same', lastName: 'Old' } as any,
      );
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('getUserStatistics: зміна без tags → "Без тегу"', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findMany.mockResolvedValue([
        { date: new Date(2026, 5, 1), totalHours: 5, tags: undefined },
      ]);
      const res = await service.getUserStatistics(1, 6, 2026);
      expect(res.tagDistribution.map((t) => t.name)).toContain('Без тегу');
    });
  });

  describe('getUserStatistics', () => {
    it('користувача нема → NotFound', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserStatistics(1, 6, 2026)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('агрегує години, овертайм і розподіл тегів (у т.ч. "Без тегу")', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findMany.mockResolvedValue([
        { date: new Date(2026, 5, 1), totalHours: 200, tags: [{ name: 'Ніч' }] },
        { date: new Date(2026, 5, 2), totalHours: 5, tags: [] },
      ]);
      const res = await service.getUserStatistics(1, 6, 2026);
      expect(res.totalShifts).toBe(2);
      expect(res.overtimeHours).toBeGreaterThan(0);
      const names = res.tagDistribution.map((t) => t.name);
      expect(names).toEqual(expect.arrayContaining(['Ніч', 'Без тегу']));
    });
  });

  describe('updateUser — додаткові гілки', () => {
    it('порожній DTO → BadRequest', async () => {
      await expect(
        service.updateUser({} as any, undefined, { id: 1 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('дані ідентичні → BadRequest', async () => {
      await expect(
        service.updateUser({ firstName: 'Same' } as any, undefined, {
          id: 1,
          firstName: 'Same',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('зайнята пошта → BadRequest', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 99 });
      await expect(
        service.updateUser({ email: 'taken@a.com' } as any, undefined, {
          id: 1,
          email: 'old@a.com',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('destroyUser', () => {
    it('видалити себе не можна', async () => {
      await expect(service.destroyUser(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ціль не знайдено → NotFound', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.destroyUser(1, 2)).rejects.toThrow(NotFoundException);
    });

    it('успіх → delete + аудит', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 2, email: 'a@a.com' });
      prisma.user.delete.mockResolvedValue({});
      await service.destroyUser(1, 2);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 2 } });
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
