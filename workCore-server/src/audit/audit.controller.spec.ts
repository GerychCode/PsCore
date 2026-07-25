import { AuditController } from './audit.controller';

describe('AuditController', () => {
  it('list делегує в AuditService.list', () => {
    const service = { list: jest.fn().mockReturnValue('ok') } as any;
    const controller = new AuditController(service);
    const query = { entity: 'AppRole' } as any;
    expect(controller.list(query)).toBe('ok');
    expect(service.list).toHaveBeenCalledWith(query);
  });
});
