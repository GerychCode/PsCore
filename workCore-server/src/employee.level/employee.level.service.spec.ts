import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmployeeLevelService } from './employee.level.service';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_TAGS } from '../work.shift.tag/system-tags';

describe('EmployeeLevelService', () => {
  let service: EmployeeLevelService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      workShift: { findMany: jest.fn() },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeLevelService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(EmployeeLevelService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('evaluateShift', () => {
    it('нараховує досвід: базу + години + бонус за чистоту', () => {
      const res = service.evaluateShift({
        status: 'APPROVED',
        totalHours: 8,
        tags: [],
      });
      // 10 (зміна) + 8 (години) + 2 (чиста)
      expect(res).toEqual({ score: 20, penalty: 0, clean: true });
    });

    it('штрафує підтверджену зміну з тегами (не чиста)', () => {
      const res = service.evaluateShift({
        status: 'APPROVED',
        totalHours: 8,
        tags: [{ severity: 2 }],
      });
      // 10 + 8 - 4 (тег severity 2 × 2)
      expect(res).toEqual({ score: 14, penalty: 4, clean: false });
    });

    // Раніше "чистою" вважалась лише APPROVED-зміна, тож поки адмін не апрувив,
    // надійність у всіх дорівнювала нулю і скоринг генератора її не бачив.
    it('зміна в очікуванні теж може бути чистою', () => {
      const res = service.evaluateShift({
        status: 'PENDING',
        totalHours: 0,
        tags: [],
      });
      expect(res).toEqual({ score: 12, penalty: 0, clean: true });
    });

    it('понаднормові не гіршають оцінку, а покращують', () => {
      const plain = service.evaluateShift({
        status: 'APPROVED',
        totalHours: 8,
        tags: [],
      });
      const overtime = service.evaluateShift({
        status: 'APPROVED',
        totalHours: 10,
        tags: [{ name: SYSTEM_TAGS.OVERTIME.name, severity: 1 }],
      });

      expect(overtime.score).toBeGreaterThan(plain.score);
      expect(overtime.penalty).toBe(0);
      expect(overtime.clean).toBe(true);
    });

    it('обставини поза виною працівника не штрафуються', () => {
      const res = service.evaluateShift({
        status: 'APPROVED',
        totalHours: 8,
        tags: [
          { name: SYSTEM_TAGS.OFF_SCHEDULE.name, severity: 2 },
          { name: SYSTEM_TAGS.DAY_OFF.name, severity: 2 },
        ],
      });
      expect(res).toEqual({ score: 20, penalty: 0, clean: true });
    });

    it('запізнення лишається штрафом і псує чистоту', () => {
      const res = service.evaluateShift({
        status: 'APPROVED',
        totalHours: 8,
        tags: [{ name: SYSTEM_TAGS.LATE.name, severity: 2 }],
      });
      expect(res).toEqual({ score: 14, penalty: 4, clean: false });
    });

    it('відхилена зміна не дає ні досвіду, ні штрафу', () => {
      const res = service.evaluateShift({
        status: 'REJECTED',
        totalHours: undefined,
        tags: [{ severity: 1 }],
      });
      expect(res).toEqual({ score: 0, penalty: 0, clean: false });
    });

    it('коректно обробляє відсутність тегів', () => {
      const res = service.evaluateShift({ status: 'APPROVED', totalHours: 5 });
      expect(res).toEqual({ score: 17, penalty: 0, clean: true });
    });
  });

  describe('getEmployeeLevel', () => {
    it('кидає NotFound, якщо користувача немає', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getEmployeeLevel(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('агрегує рівень, XP, надійність і статистику', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findMany.mockResolvedValue([
        { status: 'APPROVED', totalHours: 8, tags: [] },
        { status: 'APPROVED', totalHours: 8, tags: [{ severity: 2 }] },
        { status: 'PENDING', totalHours: 8, tags: [] },
        { status: 'REJECTED', totalHours: 8, tags: [{ severity: 1 }] },
      ]);

      const res = await service.getEmployeeLevel(1);

      // 20 (чиста) + 14 (зі штрафним тегом) + 20 (pending, теж чиста)
      // + 0 (rejected) = 54 XP; чистих 2 з 4 → 50%
      expect(res).toEqual({
        userId: 1,
        level: 1,
        baseLevel: 1,
        xp: 54,
        reliability: 50,
        totalShifts: 4,
        stats: {
          approved: 2,
          pending: 1,
          rejected: 1,
          cleanShifts: 2,
          penaltyPoints: 4,
        },
      });
    });

    it('XP не опускається нижче нуля', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findMany.mockResolvedValue([
        { status: 'REJECTED', totalHours: 8, tags: [] },
      ]);

      const res = await service.getEmployeeLevel(1);

      expect(res.xp).toBe(0);
      expect(res.level).toBe(1);
      expect(res.reliability).toBe(0);
    });

    it('рівень обмежений максимумом', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findMany.mockResolvedValue(
        Array.from({ length: 60 }, () => ({
          status: 'APPROVED',
          totalHours: 8,
          tags: [],
        })),
      );

      const res = await service.getEmployeeLevel(1);

      expect(res.level).toBe(10);
    });

    it('повертає рівень 1 для працівника без змін', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      prisma.workShift.findMany.mockResolvedValue([]);

      const res = await service.getEmployeeLevel(1);

      expect(res).toEqual({
        userId: 1,
        level: 1,
        baseLevel: 1,
        xp: 0,
        reliability: 0,
        totalShifts: 0,
        stats: {
          approved: 0,
          pending: 0,
          rejected: 0,
          cleanShifts: 0,
          penaltyPoints: 0,
        },
      });
    });

    it('базовий рівень від адміна працює як підлога', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, baseLevel: 5 });
      prisma.workShift.findMany.mockResolvedValue([]);

      const res = await service.getEmployeeLevel(1);

      expect(res.level).toBe(5);
      expect(res.baseLevel).toBe(5);
      expect(res.xp).toBe(400);
    });

    it('зароблена історія додається поверх базового рівня', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, baseLevel: 5 });
      prisma.workShift.findMany.mockResolvedValue(
        Array.from({ length: 5 }, () => ({
          status: 'APPROVED',
          totalHours: 8,
          tags: [],
        })),
      );

      const res = await service.getEmployeeLevel(1);

      // 400 базових + 5×20 зароблених = 500 XP → рівень 6
      expect(res.xp).toBe(500);
      expect(res.level).toBe(6);
    });
  });

  describe('compareLevels', () => {
    const base = { userId: 0, totalShifts: 0, stats: {} as any };

    it('сортує за рівнем', () => {
      const cmp = (service as any).compareLevels(
        { ...base, level: 1, reliability: 0, xp: 0 },
        { ...base, level: 2, reliability: 0, xp: 0 },
      );
      expect(cmp).toBeGreaterThan(0);
    });

    it('за рівної рівні — за надійністю', () => {
      const cmp = (service as any).compareLevels(
        { ...base, level: 2, reliability: 50, xp: 0 },
        { ...base, level: 2, reliability: 80, xp: 0 },
      );
      expect(cmp).toBeGreaterThan(0);
    });

    it('за рівних рівня й надійності — за XP', () => {
      const cmp = (service as any).compareLevels(
        { ...base, level: 2, reliability: 50, xp: 10 },
        { ...base, level: 2, reliability: 50, xp: 30 },
      );
      expect(cmp).toBeGreaterThan(0);
    });

    it('повертає 0 для повністю однакових', () => {
      const cmp = (service as any).compareLevels(
        { ...base, level: 2, reliability: 50, xp: 10 },
        { ...base, level: 2, reliability: 50, xp: 10 },
      );
      expect(cmp).toBe(0);
    });
  });

  describe('getRanking', () => {
    it('рахує рівні всіх працівників і сортує за спаданням', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      prisma.workShift.findMany
        .mockResolvedValueOnce([
          { status: 'APPROVED', totalHours: 8, tags: [] },
          { status: 'APPROVED', totalHours: 8, tags: [] },
        ])
        .mockResolvedValueOnce([]);

      const ranking = await service.getRanking();

      expect(ranking).toHaveLength(2);
      expect(ranking[0].userId).toBe(1);
      expect(ranking[0].xp).toBeGreaterThan(ranking[1].xp);
    });
  });
});
