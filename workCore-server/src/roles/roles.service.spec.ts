import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;
    service = new RolesService(prisma, audit);
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

    it('серед переданих ролей є неіснуючі → BadRequest', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 9, appRoles: [] });
      prisma.appRole.findMany.mockResolvedValue([]); // 0 знайдено при 1 запитаній
      await expect(service.setUserRoles(admin, 9, [77])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('користувача не знайдено → NotFound', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.setUserRoles(admin, 9, [1])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('onModuleInit / ensureSystemRole', () => {
    it('створює системні ролі, яких немає', async () => {
      prisma.appRole.findUnique.mockResolvedValue(null);
      await service.onModuleInit();
      expect(prisma.appRole.create).toHaveBeenCalled();
    });

    it('не створює наявні системні ролі', async () => {
      prisma.appRole.findUnique.mockResolvedValue({ id: 1 });
      await service.onModuleInit();
      expect(prisma.appRole.create).not.toHaveBeenCalled();
    });
  });

  describe('прості методи', () => {
    it('listPermissions повертає перелік', () => {
      expect(service.listPermissions().length).toBeGreaterThan(0);
    });

    it('getAll → findMany', async () => {
      await service.getAll();
      expect(prisma.appRole.findMany).toHaveBeenCalled();
    });

    it('getById: знайдено / не знайдено', async () => {
      prisma.appRole.findUnique.mockResolvedValue({ id: 3 });
      await expect(service.getById(3)).resolves.toEqual({ id: 3 });
      prisma.appRole.findUnique.mockResolvedValue(null);
      await expect(service.getById(3)).rejects.toThrow(NotFoundException);
    });

    it('getUserRoles: знайдено / не знайдено', async () => {
      prisma.user.findUnique.mockResolvedValue({ appRoles: [{ id: 1 }] });
      await expect(service.getUserRoles(3)).resolves.toEqual([{ id: 1 }]);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserRoles(3)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create — дублікат назви й дефолт', () => {
    it('дублікат назви → BadRequest', async () => {
      prisma.appRole.findFirst.mockResolvedValue({ id: 1 });
      await expect(
        service.create(admin, { name: 'Зайнято', position: 10 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('isDefault → clearDefault (updateMany)', async () => {
      prisma.appRole.findFirst.mockResolvedValue(null);
      await service.create(admin, {
        name: 'Новий дефолт',
        permissions: [],
        position: 10,
        isDefault: true,
      } as any);
      expect(prisma.appRole.updateMany).toHaveBeenCalled();
    });
  });

  describe('update — повний потік', () => {
    const editable = {
      id: 5,
      name: 'Стара',
      permissions: [Permission.MANAGE_ROLES],
      position: 10,
      isSystem: false,
      isDefault: false,
    };

    it('оновлює назву (перевіряє унікальність)', async () => {
      prisma.appRole.findUnique.mockResolvedValue(editable);
      prisma.appRole.findFirst.mockResolvedValue(null);
      await service.update(admin, 5, { name: 'Нова' } as any);
      expect(prisma.appRole.update).toHaveBeenCalled();
    });

    it('права системної ролі змінювати не можна', async () => {
      prisma.appRole.findUnique.mockResolvedValue({
        ...editable,
        isSystem: true,
      });
      await expect(
        service.update(admin, 5, {
          permissions: [Permission.MANAGE_USERS],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('isDefault → clearDefault', async () => {
      prisma.appRole.findUnique.mockResolvedValue(editable);
      await service.update(admin, 5, { isDefault: true } as any);
      expect(prisma.appRole.updateMany).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('системну роль видалити не можна', async () => {
      prisma.appRole.findUnique.mockResolvedValue({
        id: 5,
        isSystem: true,
        permissions: [],
        position: 0,
      });
      await expect(service.remove(admin, 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('адмін видаляє звичайну роль', async () => {
      prisma.appRole.findUnique.mockResolvedValue({
        id: 5,
        isSystem: false,
        permissions: [Permission.MANAGE_ROLES],
        position: 10,
        name: 'X',
      });
      const res = await service.remove(admin, 5);
      expect(prisma.appRole.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(res).toEqual({ success: true });
    });
  });

  describe('assignDefaultRole', () => {
    it('немає дефолтної ролі → нічого', async () => {
      prisma.appRole.findFirst.mockResolvedValue(null);
      await service.assignDefaultRole(9);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('є дефолтна роль → приєднує', async () => {
      prisma.appRole.findFirst.mockResolvedValue({ id: 2 });
      await service.assignDefaultRole(9);
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });
});
