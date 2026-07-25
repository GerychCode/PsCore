import { AuditService } from './audit.service';
import { AuditAction } from './audit.actions';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new AuditService(prisma);
  });

  describe('log', () => {
    it('записує подію з нормалізованими полями', async () => {
      await service.log({
        actorId: 5,
        action: AuditAction.ROLE_DELETED,
        entity: 'AppRole',
        entityId: 9,
        metadata: { name: 'X' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 5,
          action: 'ROLE_DELETED',
          entity: 'AppRole',
          entityId: 9,
        }),
      });
    });

    it('actorId за замовчуванням null (системна дія)', async () => {
      await service.log({
        action: AuditAction.SHIFT_AUTO_CLOSED,
        entity: 'WorkShift',
        entityId: 3,
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorId: null }),
      });
    });

    it('збій запису НЕ валить основну дію', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.log({ action: AuditAction.USER_DELETED, entity: 'User' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('фільтрує і повертає nextCursor коли сторінка повна', async () => {
      const items = Array.from({ length: 2 }, (_, i) => ({ id: 10 - i }));
      prisma.auditLog.findMany.mockResolvedValue(items);
      const res = await service.list({ entity: 'AppRole', limit: 2 });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { entity: 'AppRole' }, take: 2 }),
      );
      expect(res.nextCursor).toBe(9);
    });

    it('nextCursor = null коли сторінка неповна', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: 5 }]);
      const res = await service.list({ limit: 50 });
      expect(res.nextCursor).toBeNull();
    });
  });
});
