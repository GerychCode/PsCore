import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RolesService, Actor } from './roles.service';
import { Permission } from '../common/permissions/permission.enum';

describe('RolesService (анти-ескалація)', () => {
  let service: RolesService;
  let prisma: any;

  // Повний адмін (enum) — може все
  const admin: Actor = { id: 1, role: 'Admin', appRoles: [] };
  // Менеджер: MANAGE_ROLES на позиції 50, без ADMINISTRATOR
  const manager: Actor = {
    id: 2,
    role: 'Employe',
    appRoles: [{ permissions: [Permission.MANAGE_ROLES], position: 50 }],
  };

  beforeEach(() => {
    prisma = {
      appRole: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 10 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
        delete: jest.fn().mockResolvedValue({ id: 10 }),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    service = new RolesService(prisma);
  });

  describe('create', () => {
    it('менеджер не може створити роль із правом, якого не має', async () => {
      await expect(
        service.create(manager, {
          name: 'Хакер',
          permissions: [Permission.ADMINISTRATOR],
          position: 10,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('менеджер не може створити роль на позиції ≥ своєї', async () => {
      await expect(
        service.create(manager, {
          name: 'Рівний',
          permissions: [Permission.MANAGE_ROLES],
          position: 50,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('менеджер створює роль у межах своїх прав і нижче позиції', async () => {
      await service.create(manager, {
        name: 'Помічник',
        permissions: [Permission.MANAGE_ROLES],
        position: 10,
      } as any);
      expect(prisma.appRole.create).toHaveBeenCalled();
    });

    it('заборонено робити дефолтною роль з ADMINISTRATOR', async () => {
      await expect(
        service.create(admin, {
          name: 'СуперДефолт',
          permissions: [Permission.ADMINISTRATOR],
          position: 10,
          isDefault: true,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('адмін може створити будь-яку роль', async () => {
      await service.create(admin, {
        name: 'Модератор',
        permissions: [Permission.ADMINISTRATOR],
        position: 90,
      } as any);
      expect(prisma.appRole.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('менеджер не може підняти дефолтність системного Адміністратора', async () => {
      prisma.appRole.findUnique.mockResolvedValue({
        id: 5,
        name: 'Адміністратор',
        permissions: [Permission.ADMINISTRATOR],
        position: 100,
        isSystem: true,
        isDefault: false,
      });
      // роль вища за менеджера → блок ще на етапі керування
      await expect(
        service.update(manager, 5, { isDefault: true } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setUserRoles', () => {
    it('менеджер не може призначити роль сильнішу за себе', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 9, appRoles: [] });
      prisma.appRole.findMany.mockResolvedValue([
        { id: 5, permissions: [Permission.ADMINISTRATOR], position: 100 },
      ]);
      await expect(
        service.setUserRoles(manager, 9, [5]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('менеджер призначає роль у своїх межах', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 9, appRoles: [] });
      prisma.appRole.findMany.mockResolvedValue([
        { id: 6, permissions: [Permission.MANAGE_ROLES], position: 10 },
      ]);
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 9, appRoles: [] })
        .mockResolvedValueOnce({ id: 9, appRoles: [{ id: 6 }] });
      await service.setUserRoles(manager, 9, [6]);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('менеджер не може ЗНЯТИ роль сильнішу за себе', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 9,
        appRoles: [
          { id: 5, permissions: [Permission.ADMINISTRATOR], position: 100 },
        ],
      });
      // намагається лишити порожній набір → зняти адмінську роль
      await expect(service.setUserRoles(manager, 9, [])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('адмін призначає будь-які ролі', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 9, appRoles: [] });
      prisma.appRole.findMany.mockResolvedValue([
        { id: 5, permissions: [Permission.ADMINISTRATOR], position: 100 },
      ]);
      await service.setUserRoles(admin, 9, [5]);
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });
});
