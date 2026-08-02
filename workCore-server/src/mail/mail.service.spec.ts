import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
  const makeConfig = (host?: string) => ({
    get: jest.fn((key: string) => {
      const map: Record<string, string | undefined> = {
        SMTP_HOST: host,
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
        SMTP_FROM: 'no-reply@x',
        CLIENT_URL: 'http://localhost:1489',
      };
      return map[key];
    }),
  });

  afterEach(() => jest.clearAllMocks());

  it('без SMTP_HOST — dev-режим, листи лише в лог', async () => {
    const service = new MailService(makeConfig(undefined) as any);
    service.onModuleInit();
    // send без транспортера не кидає
    await expect(
      service.sendVerificationEmail('a@a.com', 'tok'),
    ).resolves.toBeUndefined();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('зі SMTP_HOST — створює транспортер і шле лист', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail,
      // onModuleInit перевіряє зʼєднання одразу
      verify: jest.fn().mockResolvedValue(true),
    });

    const service = new MailService(makeConfig('smtp.x') as any);
    service.onModuleInit();
    expect(nodemailer.createTransport).toHaveBeenCalled();

    await service.sendPasswordResetEmail('a@a.com', 'tok');
    expect(sendMail).toHaveBeenCalled();
  });

  it('збій SMTP не валить виклик (ловиться)', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('smtp down'));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail,
      // onModuleInit перевіряє зʼєднання одразу
      verify: jest.fn().mockResolvedValue(true),
    });

    const service = new MailService(makeConfig('smtp.x') as any);
    service.onModuleInit();
    await expect(
      service.sendInvitationEmail('a@a.com', 'tok', 'Іван'),
    ).resolves.toBeUndefined();
  });

  it('sendInvitationEmail без імені теж працює', async () => {
    const service = new MailService(makeConfig(undefined) as any);
    service.onModuleInit();
    await expect(
      service.sendInvitationEmail('a@a.com', 'tok'),
    ).resolves.toBeUndefined();
  });
});

describe('MailService — діагностика Gmail', () => {
  const gmailConfig = (over: Record<string, string> = {}) => ({
    get: jest.fn((key: string) => {
      const map: Record<string, string | undefined> = {
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'boss@gmail.com',
        // App Password Google — рівно 16 символів
        SMTP_PASS: 'abcdefghijklmnop',
        SMTP_FROM: 'boss@gmail.com',
        ...over,
      };
      return map[key];
    }),
  });

  const transport = () => ({
    sendMail: jest.fn().mockResolvedValue({}),
    verify: jest.fn().mockResolvedValue(true),
  });

  beforeEach(() => {
    (nodemailer.createTransport as jest.Mock).mockReturnValue(transport());
  });

  afterEach(() => jest.restoreAllMocks());

  const warnings = (service: MailService) => {
    const spy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    service.onModuleInit();
    return spy.mock.calls.map((c) => String(c[0]));
  };

  it('коректна конфігурація не дає попереджень', () => {
    const service = new MailService(gmailConfig() as any);
    expect(warnings(service)).toHaveLength(0);
  });

  it('попереджає про звичайний пароль замість App Password', () => {
    const service = new MailService(gmailConfig({ SMTP_PASS: 'mypassword' }) as any);
    expect(warnings(service).join(' ')).toMatch(/App Password/);
  });

  it('попереджає, коли SMTP_FROM не збігається з акаунтом', () => {
    const service = new MailService(
      gmailConfig({ SMTP_FROM: 'no-reply@workcore.app' }) as any,
    );
    expect(warnings(service).join(' ')).toMatch(/не збігається/);
  });

  it('попереджає про порт 465 без SMTP_SECURE', () => {
    const service = new MailService(gmailConfig({ SMTP_PORT: '465' }) as any);
    expect(warnings(service).join(' ')).toMatch(/465/);
  });

  it('isConfigured false у dev-режимі', () => {
    const service = new MailService(
      gmailConfig({ SMTP_HOST: undefined as any }) as any,
    );
    service.onModuleInit();
    expect(service.isConfigured()).toBe(false);
  });

  it('sendTestEmail у dev-режимі повертає причину, а не падає', async () => {
    const service = new MailService(
      gmailConfig({ SMTP_HOST: undefined as any }) as any,
    );
    service.onModuleInit();
    await expect(service.sendTestEmail('a@a.com')).resolves.toEqual({
      sent: false,
      reason: expect.stringContaining('SMTP не налаштовано'),
    });
  });
});
