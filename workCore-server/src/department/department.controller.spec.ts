import { HttpException } from '@nestjs/common';
import { DepartmentController } from './department.controller';

describe('DepartmentController', () => {
  let controller: DepartmentController;
  let service: any;
  let departmentLink: any;

  beforeEach(() => {
    service = {
      getAllDepartments: jest.fn(),
      getDepartmentById: jest.fn(),
      createDepartment: jest.fn(),
      updateDepartment: jest.fn(),
      deleteDepartment: jest.fn(),
    };
    departmentLink = {
      status: jest.fn().mockResolvedValue({ id: 1, name: 'Почайна', linked: false }),
      createCode: jest
        .fn()
        .mockResolvedValue({ code: 'DEP-AB2CD', expiresInSec: 300 }),
      unlink: jest.fn().mockResolvedValue({ id: 1, linked: false }),
    };
    controller = new DepartmentController(service, departmentLink);
  });

  describe('getAllDepartment', () => {
    it('повертає список', async () => {
      service.getAllDepartments.mockResolvedValue([{ id: 1 }]);
      await expect(controller.getAllDepartment()).resolves.toEqual([{ id: 1 }]);
    });

    it('перетворює помилку зі статусом на HttpException', async () => {
      service.getAllDepartments.mockRejectedValue({
        message: 'fail',
        status: 503,
      });
      await expect(controller.getAllDepartment()).rejects.toThrow(HttpException);
    });

    it('перетворює помилку без статусу на HttpException', async () => {
      service.getAllDepartments.mockRejectedValue({ message: 'fail' });
      await expect(controller.getAllDepartment()).rejects.toThrow(HttpException);
    });
  });

  describe('getDepartmentById', () => {
    it('повертає відділення', async () => {
      service.getDepartmentById.mockResolvedValue({ id: 2 });
      await expect(controller.getDepartmentById(2)).resolves.toEqual({ id: 2 });
    });

    it('перетворює помилку без статусу на HttpException', async () => {
      service.getDepartmentById.mockRejectedValue({ message: 'oops' });
      await expect(controller.getDepartmentById(2)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('createDepartment', () => {
    it('створює відділення', async () => {
      service.createDepartment.mockResolvedValue({ id: 3 });
      await expect(controller.createDepartment({} as any)).resolves.toEqual({
        id: 3,
      });
    });

    it('перетворює помилку на HttpException', async () => {
      service.createDepartment.mockRejectedValue({ message: 'bad' });
      await expect(controller.createDepartment({} as any)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('updateDepartment', () => {
    it('оновлює відділення', async () => {
      service.updateDepartment.mockResolvedValue({ id: 4 });
      await expect(
        controller.updateDepartment(4, {} as any),
      ).resolves.toEqual({ id: 4 });
    });

    it('перетворює помилку зі статусом на HttpException', async () => {
      service.updateDepartment.mockRejectedValue({ message: 'bad', status: 400 });
      await expect(controller.updateDepartment(4, {} as any)).rejects.toThrow(
        HttpException,
      );
    });

    it('перетворює помилку без статусу на HttpException', async () => {
      service.updateDepartment.mockRejectedValue({ message: 'bad' });
      await expect(controller.updateDepartment(4, {} as any)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('deleteDepartment', () => {
    it('видаляє відділення', async () => {
      service.deleteDepartment.mockResolvedValue({ id: 5 });
      await expect(controller.deleteDepartment(5)).resolves.toEqual({ id: 5 });
    });

    it('перетворює помилку на HttpException', async () => {
      service.deleteDepartment.mockRejectedValue({ message: 'bad' });
      await expect(controller.deleteDepartment(5)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('склад відділу', () => {
    it('getMembers делегує', async () => {
      service.getMembers = jest.fn().mockResolvedValue([{ id: 2 }]);
      await expect(controller.getMembers(1)).resolves.toEqual([{ id: 2 }]);
    });

    it('setMembers делегує', async () => {
      service.setMembers = jest.fn().mockResolvedValue([{ id: 2 }]);
      await controller.setMembers(1, { userIds: [2, 3] } as any);
      expect(service.setMembers).toHaveBeenCalledWith(1, [2, 3]);
    });
  });
});
