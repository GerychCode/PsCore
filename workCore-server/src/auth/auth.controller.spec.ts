import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    logout: jest.Mock;
    changePassword: jest.Mock;
    verifyEmail: jest.Mock;
    resendVerification: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      login: jest.fn().mockResolvedValue({ id: 1 }),
      logout: jest.fn().mockResolvedValue(undefined),
      changePassword: jest.fn().mockResolvedValue({ message: 'ok' }),
      verifyEmail: jest.fn().mockResolvedValue({ message: 'ok' }),
      resendVerification: jest.fn().mockResolvedValue({ message: 'ok' }),
      forgotPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
      resetPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
    };
    controller = new AuthController(authService as any);
  });

  it('changePassword делегує до authService', async () => {
    const req = { sessionID: 'sess-1' } as any;
    await controller.changePassword(
      5,
      {
        currentPassword: 'a',
        newPassword: 'NewPass123',
      } as any,
      req,
    );
    expect(authService.changePassword).toHaveBeenCalledWith(
      5,
      'a',
      'NewPass123',
      'sess-1',
    );
  });

  it('login делегує до authService.login', async () => {
    const req = {} as any;
    const dto = { email: 'a@a.com' } as any;
    await controller.login(req, dto);
    expect(authService.login).toHaveBeenCalledWith(req, dto);
  });

  it('logout делегує до authService.logout', async () => {
    const req = {} as any;
    const res = {} as any;
    await controller.logout(res, req);
    expect(authService.logout).toHaveBeenCalledWith(res, req);
  });

  it('verifyEmail делегує токен', async () => {
    await controller.verifyEmail({ token: 't' } as any);
    expect(authService.verifyEmail).toHaveBeenCalledWith('t');
  });

  it('resendVerification делегує пошту', async () => {
    await controller.resendVerification({ email: 'a@a.com' } as any);
    expect(authService.resendVerification).toHaveBeenCalledWith('a@a.com');
  });

  it('forgotPassword делегує пошту', async () => {
    await controller.forgotPassword({ email: 'a@a.com' } as any);
    expect(authService.forgotPassword).toHaveBeenCalledWith('a@a.com');
  });

  it('resetPassword делегує токен і пароль', async () => {
    await controller.resetPassword({ token: 't', password: 'NewPass123' } as any);
    expect(authService.resetPassword).toHaveBeenCalledWith('t', 'NewPass123');
  });
});
