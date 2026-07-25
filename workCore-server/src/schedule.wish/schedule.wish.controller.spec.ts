import { ScheduleWishController } from './schedule.wish.controller';

describe('ScheduleWishController', () => {
  let service: any;
  let controller: ScheduleWishController;

  beforeEach(() => {
    service = {
      getMyWishes: jest.fn().mockReturnValue('wishes'),
      addWish: jest.fn().mockReturnValue('added'),
      removeWishByDate: jest.fn().mockReturnValue('removedByDate'),
      removeWish: jest.fn().mockReturnValue('removed'),
    };
    controller = new ScheduleWishController(service);
  });

  it('getMyWishes', () => {
    expect(controller.getMyWishes(1, '2026-06-01', '2026-06-30')).toBe('wishes');
    expect(service.getMyWishes).toHaveBeenCalledWith(1, '2026-06-01', '2026-06-30');
  });

  it('addWish', () => {
    expect(controller.addWish(1, { date: '2026-06-01' } as any)).toBe('added');
    expect(service.addWish).toHaveBeenCalledWith(1, '2026-06-01');
  });

  it('removeByDate', () => {
    expect(controller.removeByDate(1, '2026-06-01')).toBe('removedByDate');
    expect(service.removeWishByDate).toHaveBeenCalledWith(1, '2026-06-01');
  });

  it('remove', () => {
    expect(controller.remove(1, 9)).toBe('removed');
    expect(service.removeWish).toHaveBeenCalledWith(1, 9);
  });
});
