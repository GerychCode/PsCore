import { UserController } from './user.controller';

describe('UserController', () => {
  let controller: UserController;
  let userService: any;

  beforeEach(() => {
    userService = {
      findById: jest.fn().mockResolvedValue({ id: 1 }),
      generateTelegramCode: jest.fn().mockResolvedValue('123456'),
      saveAvatarToDB: jest.fn().mockResolvedValue({ id: 1 }),
      findAllUsers: jest.fn().mockResolvedValue([]),
      updateUser: jest.fn().mockResolvedValue({ id: 1 }),
      destroyUser: jest.fn().mockResolvedValue(200),
      destroySelf: jest.fn().mockResolvedValue(200),
      getUserStatistics: jest.fn().mockResolvedValue({ totalHours: 0 }),
    };
    controller = new UserController(userService);
  });

  it('getUser повертає поточного користувача з правами', async () => {
    userService.findById.mockResolvedValue({ id: 1, firstName: 'A' });
    const me = { id: 1, role: 'Admin', appRoles: [] } as any;
    const result: any = await controller.getUser(me);
    expect(userService.findById).toHaveBeenCalledWith(1);
    // enum Admin → усі права
    expect(result.permissions).toContain('ADMINISTRATOR');
  });

  it('getUserById знаходить за id (адмін бачить все)', async () => {
    const admin = { id: 1, role: 'Admin' } as any;
    await controller.getUserById(admin, 5);
    expect(userService.findById).toHaveBeenCalledWith(5);
  });

  it('getUserById ховає чутливі поля від чужого профілю', async () => {
    userService.findById.mockResolvedValue({
      id: 5,
      firstName: 'A',
      phone: '+380',
      address: 'вул. Тестова',
      dateOfBirth: new Date(),
    });
    const employee = { id: 1, role: 'Employe' } as any;
    const result: any = await controller.getUserById(employee, 5);
    expect(result.phone).toBeUndefined();
    expect(result.address).toBeUndefined();
    expect(result.dateOfBirth).toBeUndefined();
    expect(result.firstName).toBe('A');
  });

  it('generateTelegramCode повертає код', async () => {
    const res = await controller.generateTelegramCode(1);
    expect(res).toEqual({ code: '123456' });
  });

  it('uploadFile зберігає аватар', async () => {
    const user = { id: 1 } as any;
    const file = { filename: 'a.png' } as any;
    await controller.uploadFile(user, file);
    expect(userService.saveAvatarToDB).toHaveBeenCalledWith(user, file);
  });

  it('getAllUsers повертає список (без PII для звичайного користувача)', async () => {
    const requester = { id: 1, role: 'Employe', appRoles: [] } as any;
    await controller.getAllUsers(requester);
    expect(userService.findAllUsers).toHaveBeenCalledWith(false);
  });

  it('getAllUsers віддає PII власнику VIEW_ALL_PROFILES', async () => {
    const requester = {
      id: 1,
      role: 'Employe',
      appRoles: [{ permissions: ['VIEW_ALL_PROFILES'] }],
    } as any;
    await controller.getAllUsers(requester);
    expect(userService.findAllUsers).toHaveBeenCalledWith(true);
  });

  it('updateUserForAdmin оновлює за id', async () => {
    const dto = { firstName: 'A' } as any;
    await controller.updateUserForAdmin(2, dto);
    expect(userService.updateUser).toHaveBeenCalledWith(dto, 2);
  });

  it('updateUser оновлює поточного користувача', async () => {
    const user = { id: 1 } as any;
    const dto = { firstName: 'A' } as any;
    await controller.updateUser(user, dto);
    expect(userService.updateUser).toHaveBeenCalledWith(dto, undefined, user);
  });

  it('deleteUser видаляє цільового користувача', async () => {
    await controller.deleteUser(1, 2);
    expect(userService.destroyUser).toHaveBeenCalledWith(1, 2);
  });

  it('delete видаляє власний акаунт', async () => {
    const dto = { password: 'x' } as any;
    await controller.delete(1, dto);
    expect(userService.destroySelf).toHaveBeenCalledWith(1, dto);
  });

  it('getStatistics використовує передані місяць і рік', async () => {
    await controller.getStatistics(1, '6', '2026');
    expect(userService.getUserStatistics).toHaveBeenCalledWith(1, 6, 2026);
  });

  it('getStatistics використовує поточну дату за замовчуванням', async () => {
    await controller.getStatistics(1);
    const call = userService.getUserStatistics.mock.calls[0];
    expect(call[0]).toBe(1);
    expect(typeof call[1]).toBe('number');
    expect(typeof call[2]).toBe('number');
  });

  it('getStatistics з валідними місяцем/роком', async () => {
    await controller.getStatistics(1, '6', '2026');
    expect(userService.getUserStatistics).toHaveBeenCalledWith(1, 6, 2026);
  });

  it('notification prefs: get і update делегують', async () => {
    userService.getNotificationPrefs = jest.fn().mockResolvedValue({});
    userService.updateNotificationPrefs = jest.fn().mockResolvedValue({});
    await controller.getNotificationPrefs(1);
    await controller.updateNotificationPrefs(1, { preferences: { a: 1 } } as any);
    expect(userService.getNotificationPrefs).toHaveBeenCalledWith(1);
    expect(userService.updateNotificationPrefs).toHaveBeenCalledWith(1, { a: 1 });
  });

  it('generateTelegramCode делегує', async () => {
    const res = await controller.generateTelegramCode(1);
    expect(res).toEqual({ code: '123456' });
  });
});
