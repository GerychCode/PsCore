import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let prisma: any;
  let userService: any;
  let rolesService: any;
  let mailService: any;
  let config: any;
  let redis: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    userService = {
      findByEmail: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 10 }),
      updatePassword: jest.fn().mockResolvedValue({}),
      markEmailVerified: jest.fn().mockResolvedValue({}),
    };
    rolesService = { assignDefaultRole: jest.fn().mockResolvedValue(undefined) };
    mailService = { sendInvitationEmail: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('http://localhost:1489') };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    service = new InvitationsService(
      prisma,
      userService,
      rolesService,
      mailService,
      config,
      redis,
    );
  });

  describe('createInvitation', () => {
    it('новий користувач: створює + дефолтна роль + токен', async () => {
      userService.findByEmail.mockResolvedValue(null);
      const res = await service.createInvitation({
        email: 'NEW@a.com',
        firstName: 'І',
        lastName: 'П',
      } as any);
      expect(userService.create).toHaveBeenCalled();
      expect(rolesService.assignDefaultRole).toHaveBeenCalledWith(10);
      expect(res.registrationLink).toContain('token=');
    });

    it('уже зареєстрований (є пароль) → BadRequest', async () => {
      userService.findByEmail.mockResolvedValue({ id: 5, passwordHash: 'h' });
      await expect(
        service.createInvitation({
          email: 'a@a.com',
          firstName: 'І',
          lastName: 'П',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('незавершене запрошення: оновлює ПІБ і перевидає токен', async () => {
      userService.findByEmail.mockResolvedValue({ id: 5, passwordHash: '' });
      redis.get.mockResolvedValue('old-token'); // pointer існує → del old
      const res = await service.createInvitation({
        email: 'a@a.com',
        firstName: 'Н',
        lastName: 'П',
      } as any);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(res.userId).toBe(5);
    });
  });

  describe('sendInvitationEmail', () => {
    it('надсилає лист із наявним/новим токеном', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 5,
        passwordHash: '',
        email: 'a@a.com',
        firstName: 'І',
      });
      redis.get.mockResolvedValue(null); // немає токена → issue
      const res = await service.sendInvitationEmail(5);
      expect(mailService.sendInvitationEmail).toHaveBeenCalled();
      expect(res.message).toBeDefined();
    });

    it('користувача нема → NotFound', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.sendInvitationEmail(5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('уже зареєстрований → BadRequest', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 5, passwordHash: 'h' });
      await expect(service.sendInvitationEmail(5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('наявний токен у pointer — не перевидає', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 5,
        passwordHash: '',
        email: 'a@a.com',
        firstName: 'І',
      });
      redis.get.mockResolvedValue('existing-token');
      await service.sendInvitationEmail(5);
      expect(mailService.sendInvitationEmail).toHaveBeenCalledWith(
        'a@a.com',
        'existing-token',
        'І',
      );
    });
  });

  describe('getInvitation', () => {
    it('валідний токен → дані', async () => {
      redis.get.mockResolvedValue('5');
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'І',
        lastName: 'П',
        email: 'a@a.com',
      });
      await expect(service.getInvitation('tok')).resolves.toHaveProperty(
        'email',
      );
    });

    it('токен недійсний → NotFound', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.getInvitation('tok')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('користувача нема → NotFound', async () => {
      redis.get.mockResolvedValue('5');
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getInvitation('tok')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('acceptInvitation', () => {
    it('валідний токен → ставить пароль і верифікує', async () => {
      redis.get.mockResolvedValue('5');
      const res = await service.acceptInvitation('tok', 'Pass1234');
      expect(userService.updatePassword).toHaveBeenCalledWith(5, 'Pass1234');
      expect(userService.markEmailVerified).toHaveBeenCalledWith(5);
      expect(res.message).toBeDefined();
    });

    it('недійсний токен → BadRequest', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.acceptInvitation('tok', 'Pass1234')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
