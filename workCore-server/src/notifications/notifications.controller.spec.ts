import { UnauthorizedException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: any;

  const req = (userId?: number) => ({ session: { userId } }) as any;

  beforeEach(() => {
    service = {
      getUserNotifications: jest.fn().mockResolvedValue([{ id: 1 }]),
      markAllAsRead: jest.fn().mockResolvedValue({ count: 1 }),
      markAsRead: jest.fn().mockResolvedValue({ count: 1 }),
      deleteNotification: jest.fn(),
    };
    controller = new NotificationsController(service);
  });

  it('getNotifications повертає сповіщення користувача', async () => {
    const res = await controller.getNotifications(req(5));
    expect(service.getUserNotifications).toHaveBeenCalledWith(5);
    expect(res).toEqual([{ id: 1 }]);
  });

  it('кидає Unauthorized без userId у сесії', async () => {
    await expect(controller.getNotifications(req(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('markAllAsRead повертає success', async () => {
    const res = await controller.markAllAsRead(req(5));
    expect(service.markAllAsRead).toHaveBeenCalledWith(5);
    expect(res).toEqual({ success: true });
  });

  it('markAsRead повертає success', async () => {
    const res = await controller.markAsRead(req(5), 10);
    expect(service.markAsRead).toHaveBeenCalledWith(5, 10);
    expect(res).toEqual({ success: true });
  });

  it('deleteNotification повертає success при видаленні', async () => {
    service.deleteNotification.mockResolvedValue(true);
    const res = await controller.deleteNotification(req(5), 10);
    expect(res).toEqual({ success: true });
  });

  it('deleteNotification повертає помилку, якщо не знайдено', async () => {
    service.deleteNotification.mockResolvedValue(false);
    const res = await controller.deleteNotification(req(5), 10);
    expect(res).toEqual({
      success: false,
      message: 'Повідомлення не знайдено або немає доступу',
    });
  });
});
