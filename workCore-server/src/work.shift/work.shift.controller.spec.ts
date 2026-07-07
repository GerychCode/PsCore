import { WorkShiftController } from './work.shift.controller';

describe('WorkShiftController', () => {
  let controller: WorkShiftController;
  let service: any;

  const user = { id: 1, role: 'Admin' } as any;

  beforeEach(() => {
    service = {
      getWorkShifts: jest.fn().mockResolvedValue([]),
      getWorkShiftById: jest.fn().mockResolvedValue({ id: 1 }),
      createWorkShift: jest.fn().mockResolvedValue({ id: 1 }),
      updateWorkShiftDto: jest.fn().mockResolvedValue({ id: 1 }),
      deleteShift: jest.fn().mockResolvedValue({ id: 1 }),
    };
    controller = new WorkShiftController(service);
  });

  it('getWorkShifts делегує з фільтром', async () => {
    const filter = { status: 'PENDING' } as any;
    await controller.getWorkShifts(user, filter);
    expect(service.getWorkShifts).toHaveBeenCalledWith(user, filter);
  });

  it('getWorkShiftById делегує за id', async () => {
    await controller.getWorkShiftById(3);
    expect(service.getWorkShiftById).toHaveBeenCalledWith(3);
  });

  it('createWorkShift делегує', async () => {
    const dto = { date: '2026-06-01' } as any;
    await controller.createWorkShift(user, dto);
    expect(service.createWorkShift).toHaveBeenCalledWith(user, dto);
  });

  it('updateWorkShift делегує', async () => {
    const dto = { startedAt: '09:00' } as any;
    await controller.updateWorkShift(user, 3, dto);
    expect(service.updateWorkShiftDto).toHaveBeenCalledWith(3, dto, user);
  });

  it('deleteWorkShiftById делегує', async () => {
    await controller.deleteWorkShiftById(user, 3);
    expect(service.deleteShift).toHaveBeenCalledWith(user, 3);
  });
});
