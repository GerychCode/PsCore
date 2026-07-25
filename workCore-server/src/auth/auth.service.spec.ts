import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
    markEmailVerified: jest.Mock;
    updatePassword: jest.Mock;
    findByIdRaw: jest.Mock;
    clearMustChangePassword: jest.Mock;
  };
  let mailService: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };
  let redis: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    scanStream: jest.Mock;
  };

  const buildReq = (
    saveErr?: unknown,
    destroyErr?: unknown,
    regenErr?: unknown,
  ) =>
    ({
      sessionID: 'sess-test',
      session: {
        userId: undefined,
        // session fixation: login регенерує сесію перед save
        regenerate: jest.fn((cb: (err?: unknown) => void) => cb(regenErr)),
        save: jest.fn((cb: (err?: unknown) => void) => cb(saveErr)),
        destroy: jest.fn((cb: (err?: unknown) => void) => cb(destroyErr)),
      },
    }) as any;

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      markEmailVerified: jest.fn(),
      updatePassword: jest.fn(),
      findByIdRaw: jest.fn(),
      clearMustChangePassword: jest.fn(),
    };
    mailService = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };
    redis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      // reset інвалідує сесії через scanStream — повертаємо порожній потік
      scanStream: jest.fn().mockReturnValue(
        (async function* () {
          /* без сесій */
        })(),
      ),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('session') },
        },
        { provide: MailService, useValue: mailService },
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('changePassword', () => {
    it('змінює пароль при вірному поточному й скидає прапорець', async () => {
      userService.findByIdRaw.mockResolvedValue({ id: 5, passwordHash: 'h' });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      await service.changePassword(5, 'OldPass1', 'NewPass123');
      expect(userService.updatePassword).toHaveBeenCalledWith(5, 'NewPass123');
      expect(userService.clearMustChangePassword).toHaveBeenCalledWith(5);
    });

    it('кидає помилку при невірному поточному паролі', async () => {
      userService.findByIdRaw.mockResolvedValue({ id: 5, passwordHash: 'h' });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(false);
      await expect(
        service.changePassword(5, 'wrong', 'NewPass123'),
      ).rejects.toThrow(BadRequestException);
      expect(userService.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('підтверджує пошту за валідним токеном', async () => {
      redis.get.mockResolvedValue('5');
      await service.verifyEmail('tok');
      expect(userService.markEmailVerified).toHaveBeenCalledWith(5);
      expect(redis.del).toHaveBeenCalledWith('verify-email:tok');
    });

    it('кидає помилку за недійсним токеном', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.verifyEmail('bad')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('надсилає лист, якщо акаунт існує', async () => {
      userService.findByEmail.mockResolvedValue({ id: 9 });
      await service.forgotPassword('a@a.com');
      expect(redis.set).toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('не розкриває відсутність акаунта (тиха відповідь)', async () => {
      userService.findByEmail.mockResolvedValue(null);
      const res = await service.forgotPassword('none@a.com');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(res.message).toBeDefined();
    });
  });

  describe('resetPassword', () => {
    it('оновлює пароль, підтверджує пошту й скидає токен', async () => {
      redis.get.mockResolvedValue('9');
      await service.resetPassword('tok', 'NewPass123');
      expect(userService.updatePassword).toHaveBeenCalledWith(9, 'NewPass123');
      expect(userService.markEmailVerified).toHaveBeenCalledWith(9);
      expect(redis.del).toHaveBeenCalledWith('password-reset:tok');
      // сесії користувача вилогінено
      expect(redis.scanStream).toHaveBeenCalled();
    });

    it('кидає помилку за недійсним токеном', async () => {
      redis.get.mockResolvedValue(null);
      await expect(
        service.resetPassword('bad', 'NewPass123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    const dto = { email: 'ivan@example.com', password: 'secret' } as any;

    it('кидає помилку, якщо користувача не знайдено', async () => {
      userService.findByEmail.mockResolvedValue(null);
      await expect(service.login(buildReq(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('кидає помилку, якщо немає хешу пароля', async () => {
      userService.findByEmail.mockResolvedValue({ id: 1, passwordHash: null });
      await expect(service.login(buildReq(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('кидає помилку при невірному паролі', async () => {
      userService.findByEmail.mockResolvedValue({ id: 1, passwordHash: 'h' });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(false);
      await expect(service.login(buildReq(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('блокує вхід непідтвердженого користувача', async () => {
      userService.findByEmail.mockResolvedValue({
        id: 7,
        passwordHash: 'h',
        isEmailVerified: false,
      });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      await expect(service.login(buildReq(), dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('успішний вхід зберігає сесію', async () => {
      userService.findByEmail.mockResolvedValue({
        id: 7,
        passwordHash: 'h',
        isEmailVerified: true,
      });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      const req = buildReq();
      await service.login(req, dto);
      expect(req.session.userId).toBe(7);
    });

    it('кидає InternalServerError, якщо сесію не вдалося зберегти', async () => {
      userService.findByEmail.mockResolvedValue({
        id: 7,
        passwordHash: 'h',
        isEmailVerified: true,
      });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      await expect(
        service.login(buildReq(new Error('save fail')), dto),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('logout', () => {
    it('очищає cookie та завершує сесію', async () => {
      const req = buildReq();
      const res = { clearCookie: jest.fn() } as any;
      await service.logout(res, req);
      expect(req.session.destroy).toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('session');
    });

    it('кидає InternalServerError, якщо сесію не вдалося знищити', async () => {
      const req = buildReq(undefined, new Error('destroy fail'));
      const res = { clearCookie: jest.fn() } as any;
      await expect(service.logout(res, req)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('валідний токен → підтверджує пошту', async () => {
      redis.get.mockResolvedValue('7');
      const res = await service.verifyEmail('tok');
      expect(userService.markEmailVerified).toHaveBeenCalledWith(7);
      expect(res.message).toBeDefined();
    });

    it('недійсний токен → BadRequest', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.verifyEmail('tok')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resendVerification', () => {
    it('непідтверджений користувач → надсилає лист', async () => {
      userService.findByEmail.mockResolvedValue({
        id: 7,
        isEmailVerified: false,
      });
      redis.get.mockResolvedValue(null);
      await service.resendVerification('a@a.com');
      expect(mailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('користувача нема або вже підтверджений → тихо', async () => {
      userService.findByEmail.mockResolvedValue(null);
      await service.resendVerification('a@a.com');
      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('користувач існує → лист зі скиданням', async () => {
      userService.findByEmail.mockResolvedValue({ id: 7 });
      redis.get.mockResolvedValue(null);
      await service.forgotPassword('a@a.com');
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('користувача нема → однакова відповідь, без листа', async () => {
      userService.findByEmail.mockResolvedValue(null);
      const res = await service.forgotPassword('a@a.com');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(res.message).toBeDefined();
    });
  });

  describe('resetPassword', () => {
    it('недійсний токен → BadRequest', async () => {
      redis.get.mockResolvedValue(null);
      await expect(
        service.resetPassword('tok', 'NewPass1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('валідний токен: оновлює пароль і вилогінює інші сесії', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key.startsWith('password-reset:')) return Promise.resolve('7');
        if (key === 'sessionA') return Promise.resolve(JSON.stringify({ userId: 7 }));
        if (key === 'sessionB') return Promise.resolve('not-json'); // catch-гілка
        return Promise.resolve(null);
      });
      redis.scanStream.mockReturnValue(
        (async function* () {
          yield ['sessionA', 'sessionB'];
        })(),
      );
      await service.resetPassword('tok', 'NewPass1');
      expect(userService.updatePassword).toHaveBeenCalledWith(7, 'NewPass1');
      expect(redis.del).toHaveBeenCalledWith('sessionA');
    });
  });

  describe('додаткові гілки', () => {
    it('rotateToken видаляє попередній токен', async () => {
      userService.findByEmail.mockResolvedValue({ id: 7 });
      redis.get.mockResolvedValue('old-token'); // previous існує → del
      await service.forgotPassword('a@a.com');
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('old-token'),
      );
    });

    it('login: збій regenerate → InternalServerError', async () => {
      userService.findByEmail.mockResolvedValue({
        id: 7,
        passwordHash: 'h',
        isEmailVerified: true,
      });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      const req = buildReq(undefined, undefined, new Error('regen fail'));
      await expect(
        service.login(req, { email: 'a@a.com', password: 'x' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('changePassword з поточною сесією зберігає її (keepKey)', async () => {
      userService.findByIdRaw.mockResolvedValue({ id: 5, passwordHash: 'h' });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      redis.scanStream.mockReturnValue(
        (async function* () {
          yield ['sessionKEEP', 'sessionOTHER'];
        })(),
      );
      redis.get.mockImplementation((key: string) =>
        key === 'sessionOTHER'
          ? Promise.resolve(JSON.stringify({ userId: 5 }))
          : Promise.resolve(null),
      );
      await service.changePassword(5, 'Old1', 'New12345', 'KEEP');
      // поточну сесію (sessionKEEP) не чіпаємо
      expect(redis.del).not.toHaveBeenCalledWith('sessionKEEP');
    });
  });
});
