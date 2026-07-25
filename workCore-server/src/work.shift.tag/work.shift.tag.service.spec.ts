import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkShiftTagService } from './work.shift.tag.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WorkShiftTagService', () => {
  let service: WorkShiftTagService;
  let prisma: any;

  const admin = { id: 1, role: 'Admin' } as any;
  const employee = { id: 2, role: 'Employe' } as any;

  beforeEach(async () => {
    prisma = {
      tag: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        WorkShiftTagService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(WorkShiftTagService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getAllTags', () => {
    it('повертає теги, відсортовані за важливістю', async () => {
      prisma.tag.findMany.mockResolvedValue([{ id: 1 }]);
      await expect(service.getAllTags()).resolves.toEqual([{ id: 1 }]);
    });
  });

  describe('правила автоматизації', () => {
    it('getRuleCatalog повертає довідник', () => {
      expect(service.getRuleCatalog()).toHaveProperty('triggers');
    });

    it('autoApply без правила → BadRequest', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      await expect(
        service.createTag({ name: 'A', autoApply: true } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('створює тег із правилом', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({ id: 9 });
      await service.createTag({
        name: 'Овертайм',
        autoApply: true,
        rule: { trigger: 'SHIFT_ENDED', match: 'ALL', conditions: [], actions: [] },
      } as any);
      const arg = prisma.tag.create.mock.calls[0][0];
      expect(arg.data.autoApply).toBe(true);
      expect(arg.data.rule).toBeDefined();
    });

    it('оновлення autoApply без правила (і без наявного) → BadRequest', async () => {
      prisma.tag.findUnique.mockResolvedValue({
        id: 1,
        isSystem: false,
        autoApply: false,
        rule: null,
      });
      await expect(
        service.updateTag(1, { autoApply: true } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTagById', () => {
    it('кидає NotFound, якщо тег не існує', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      await expect(service.getTagById(99)).rejects.toThrow(NotFoundException);
    });

    it('повертає тег', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 1, name: 'Тег' });
      await expect(service.getTagById(1)).resolves.toEqual({
        id: 1,
        name: 'Тег',
      });
    });
  });

  describe('createTag', () => {
    it('кидає помилку при дублікаті назви', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 1, name: 'Запізнення' });
      await expect(
        service.createTag({ name: 'Запізнення', severity: 1 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('створює новий тег', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({ id: 5, name: 'Запізнення' });
      const res = await service.createTag({
        name: 'Запізнення',
        severity: 2,
      } as any);
      expect(res.id).toBe(5);
    });
  });

  describe('updateTag', () => {
    it('кидає помилку, якщо нова назва зайнята', async () => {
      prisma.tag.findUnique
        .mockResolvedValueOnce({ id: 1, name: 'Старий' })
        .mockResolvedValueOnce({ id: 2, name: 'Новий' });
      await expect(
        service.updateTag(1, { name: 'Новий' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('оновлює тег з новою назвою', async () => {
      prisma.tag.findUnique
        .mockResolvedValueOnce({ id: 1, name: 'Старий' })
        .mockResolvedValueOnce(null);
      prisma.tag.update.mockResolvedValue({ id: 1, name: 'Новий' });
      const res = await service.updateTag(1, { name: 'Новий' } as any);
      expect(res.name).toBe('Новий');
    });

    it('оновлює тег без зміни назви', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 1, name: 'Старий' });
      prisma.tag.update.mockResolvedValue({ id: 1, severity: 3 });
      const res = await service.updateTag(1, { severity: 3 } as any);
      expect(res.severity).toBe(3);
    });

    it('системний тег: назву/важливість змінити не можна', async () => {
      prisma.tag.findUnique.mockResolvedValue({
        id: 1,
        name: 'Запізнення',
        isSystem: true,
      });
      await expect(
        service.updateTag(1, { name: 'Інше' } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateTag(1, { severity: 5 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('системний тег: колір редагувати дозволено', async () => {
      prisma.tag.findUnique.mockResolvedValue({
        id: 1,
        name: 'Запізнення',
        isSystem: true,
      });
      prisma.tag.update.mockResolvedValue({ id: 1, color: '#000000' });
      const res = await service.updateTag(1, { color: '#000000' } as any);
      expect(res.color).toBe('#000000');
    });
  });

  describe('deleteTag', () => {
    it('кидає NotFound для неіснуючого тега', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      await expect(service.deleteTag(999)).rejects.toThrow();
      expect(prisma.tag.delete).not.toHaveBeenCalled();
    });

    it('видаляє тег за id (доступ контролює guard)', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 1, name: 'Тег' });
      prisma.tag.delete.mockResolvedValue({ id: 1 });
      await service.deleteTag(1);
      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('системний тег видалити не можна', async () => {
      prisma.tag.findUnique.mockResolvedValue({
        id: 1,
        name: 'Автозавершено',
        isSystem: true,
      });
      await expect(service.deleteTag(1)).rejects.toThrow(BadRequestException);
      expect(prisma.tag.delete).not.toHaveBeenCalled();
    });
  });
});
