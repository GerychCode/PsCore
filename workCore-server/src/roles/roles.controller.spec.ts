import { RolesController } from './roles.controller';

describe('RolesController', () => {
  let service: any;
  let controller: RolesController;
  const actor = { id: 1 } as any;

  beforeEach(() => {
    service = {
      listPermissions: jest.fn().mockReturnValue('perms'),
      getAll: jest.fn().mockReturnValue('all'),
      create: jest.fn().mockReturnValue('created'),
      update: jest.fn().mockReturnValue('updated'),
      remove: jest.fn().mockReturnValue('removed'),
      getUserRoles: jest.fn().mockReturnValue('userRoles'),
      setUserRoles: jest.fn().mockReturnValue('set'),
    };
    controller = new RolesController(service);
  });

  it('listPermissions', () => {
    expect(controller.listPermissions()).toBe('perms');
  });

  it('getAll', () => {
    expect(controller.getAll()).toBe('all');
  });

  it('create', () => {
    const dto = { name: 'R' } as any;
    expect(controller.create(actor, dto)).toBe('created');
    expect(service.create).toHaveBeenCalledWith(actor, dto);
  });

  it('update', () => {
    const dto = { name: 'R2' } as any;
    expect(controller.update(actor, 5, dto)).toBe('updated');
    expect(service.update).toHaveBeenCalledWith(actor, 5, dto);
  });

  it('remove', () => {
    expect(controller.remove(actor, 5)).toBe('removed');
    expect(service.remove).toHaveBeenCalledWith(actor, 5);
  });

  it('getUserRoles', () => {
    expect(controller.getUserRoles(7)).toBe('userRoles');
    expect(service.getUserRoles).toHaveBeenCalledWith(7);
  });

  it('setUserRoles', () => {
    const dto = { roleIds: [1, 2] } as any;
    expect(controller.setUserRoles(actor, 7, dto)).toBe('set');
    expect(service.setUserRoles).toHaveBeenCalledWith(actor, 7, [1, 2]);
  });
});
