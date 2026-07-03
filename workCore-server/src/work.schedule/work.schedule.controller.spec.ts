import { WorkScheduleController } from './work.schedule.controller';

describe('WorkScheduleController', () => {
  let controller: WorkScheduleController;
  let service: any;
  let generator: any;

  const user = { id: 1, role: 'Admin' } as any;

  beforeEach(() => {
    service = {
      getWorkSchedules: jest.fn().mockResolvedValue([]),
      getWeekView: jest.fn().mockResolvedValue([]),
      getWorkScheduleById: jest.fn().mockResolvedValue({ id: 1 }),
      createWorkSchedule: jest.fn().mockResolvedValue({ id: 1 }),
      updateWorkSchedule: jest.fn().mockResolvedValue({ id: 1 }),
      deleteWorkSchedule: jest.fn().mockResolvedValue({ id: 1 }),
      toggleWeekLock: jest.fn().mockResolvedValue({ id: 1 }),
    };
    generator = {
      generateWeek: jest.fn().mockResolvedValue({ created: 3, warnings: [] }),
      publishWeek: jest.fn().mockResolvedValue({ published: 3 }),
      rejectWeek: jest.fn().mockResolvedValue({ discarded: 3 }),
    };
    controller = new WorkScheduleController(service, generator);
  });

  it('getWorkSchedules делегує з фільтром', async () => {
    const filter = { userId: 1 } as any;
    await controller.getWorkSchedules(filter);
    expect(service.getWorkSchedules).toHaveBeenCalledWith(filter);
  });

  it('getWeekView делегує з датою і прапорцем адміна', async () => {
    await controller.getWeekView(user, { date: '2026-06-01' } as any);
    expect(service.getWeekView).toHaveBeenCalledWith('2026-06-01', true);
  });

  it('getWeekView передає false для звичайного співробітника', async () => {
    const employee = { id: 2, role: 'Employe' } as any;
    await controller.getWeekView(employee, { date: '2026-06-01' } as any);
    expect(service.getWeekView).toHaveBeenCalledWith('2026-06-01', false);
  });

  it('generateWeek делегує генератору', async () => {
    const dto = { departmentId: 1, date: '2026-06-01' } as any;
    await controller.generateWeek(dto);
    expect(generator.generateWeek).toHaveBeenCalledWith(1, '2026-06-01');
  });

  it('publishWeek делегує генератору', async () => {
    const dto = { departmentId: 1, date: '2026-06-01' } as any;
    await controller.publishWeek(dto);
    expect(generator.publishWeek).toHaveBeenCalledWith(1, '2026-06-01');
  });

  it('rejectWeek делегує генератору', async () => {
    const dto = { departmentId: 1, date: '2026-06-01' } as any;
    await controller.rejectWeek(dto);
    expect(generator.rejectWeek).toHaveBeenCalledWith(1, '2026-06-01');
  });

  it('getWorkScheduleById делегує за id', async () => {
    await controller.getWorkScheduleById(2);
    expect(service.getWorkScheduleById).toHaveBeenCalledWith(2);
  });

  it('createWorkSchedule делегує', async () => {
    const dto = { date: '2026-06-01' } as any;
    await controller.createWorkSchedule(user, dto);
    expect(service.createWorkSchedule).toHaveBeenCalledWith(user, dto);
  });

  it('updateWorkSchedule делегує', async () => {
    const dto = { startedAt: '09:00' } as any;
    await controller.updateWorkSchedule(user, 2, dto);
    expect(service.updateWorkSchedule).toHaveBeenCalledWith(user, 2, dto);
  });

  it('deleteWorkSchedule делегує', async () => {
    await controller.deleteWorkSchedule(user, 2);
    expect(service.deleteWorkSchedule).toHaveBeenCalledWith(user, 2);
  });

  it('toggleWeekLock делегує', async () => {
    const dto = { date: '2026-06-01', departmentId: 1, isLocked: true } as any;
    await controller.toggleWeekLock(dto);
    expect(service.toggleWeekLock).toHaveBeenCalledWith(dto);
  });
});
