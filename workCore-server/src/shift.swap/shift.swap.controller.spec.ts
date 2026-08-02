import { ShiftSwapController } from './shift.swap.controller';

describe('ShiftSwapController', () => {
  let service: any;
  let controller: ShiftSwapController;
  const user = { id: 1 } as any;

  beforeEach(() => {
    service = {
      list: jest.fn().mockReturnValue('list'),
      create: jest.fn().mockReturnValue('created'),
      claim: jest.fn().mockReturnValue('claimed'),
      cancel: jest.fn().mockReturnValue('cancelled'),
      approve: jest.fn().mockReturnValue('approved'),
      reject: jest.fn().mockReturnValue('rejected'),
    };
    controller = new ShiftSwapController(service);
  });

  it('list', () => {
    expect(controller.list(user)).toBe('list');
    expect(service.list).toHaveBeenCalledWith(user);
  });

  it('create', () => {
    const dto = { scheduleId: 5 } as any;
    expect(controller.create(user, dto)).toBe('created');
    expect(service.create).toHaveBeenCalledWith(user, dto);
  });

  it('claim', () => {
    expect(controller.claim(user, 3)).toBe('claimed');
    expect(service.claim).toHaveBeenCalledWith(user, 3);
  });

  it('cancel', () => {
    expect(controller.cancel(user, 3)).toBe('cancelled');
    expect(service.cancel).toHaveBeenCalledWith(user, 3);
  });

  it('approve', () => {
    expect(controller.approve(user, 3)).toBe('approved');
    expect(service.approve).toHaveBeenCalledWith(user, 3);
  });

  it('reject', () => {
    expect(controller.reject(user, 3)).toBe('rejected');
    expect(service.reject).toHaveBeenCalledWith(user, 3);
  });
});
