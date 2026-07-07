import { EmployeeLevelController } from './employee.level.controller';

describe('EmployeeLevelController', () => {
  let controller: EmployeeLevelController;
  let service: {
    getRanking: jest.Mock;
    getEmployeeLevel: jest.Mock;
  };

  beforeEach(() => {
    service = {
      getRanking: jest.fn().mockResolvedValue([{ userId: 1, level: 3 }]),
      getEmployeeLevel: jest.fn().mockResolvedValue({ userId: 1, level: 3 }),
    };
    controller = new EmployeeLevelController(service as any);
  });

  it('getRanking делегує до сервісу', async () => {
    const res = await controller.getRanking();
    expect(service.getRanking).toHaveBeenCalled();
    expect(res).toEqual([{ userId: 1, level: 3 }]);
  });

  it('getEmployeeLevel делегує до сервісу за id', async () => {
    const res = await controller.getEmployeeLevel(1);
    expect(service.getEmployeeLevel).toHaveBeenCalledWith(1);
    expect(res).toEqual({ userId: 1, level: 3 });
  });
});
