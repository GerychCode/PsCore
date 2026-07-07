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
import { RolesService } from '../roles/roles.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
    markEmailVerified: jest.Mock;
    updatePassword: jest.Mock;
  };
  let mailService: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };
  let rolesService: { assignDefaultRole: jest.Mock };
  let redis: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    scanStream: jest.Mock;
  };

  const buildReq = (saveErr?: unknown, destroyErr?: unknown) =>
    ({
      session: {
        userId: undefined,
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
    };
    mailService = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };
    rolesService = { assignDefaultRole: jest.fn() };
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
        { provide: RolesService, useValue: rolesService },
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const dto = {
      firstName: 'Іван',
      lastName: 'Петренко',
      email: 'ivan@example.com',
      password: 'secret',
    } as any;

    it('кидає помилку, якщо пошта вже використовується', async () => {
      userService.findByEmail.mockResolvedValue({ id: 1 });
      await expect(service.create(buildReq(), dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('створює непідтвердженого користувача й надсилає лист, без автологіну', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue({ id: 5 });
      const req = buildReq();
      await service.create(req, dto);
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({ isEmailVerified: false }),
      );
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        dto.email,
        expect.any(String),
      );
      // Сесія НЕ зберігається — спершу підтвердження пошти
      expect(req.session.userId).toBeUndefined();
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
});
