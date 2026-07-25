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
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new MailService(makeConfig('smtp.x') as any);
    service.onModuleInit();
    expect(nodemailer.createTransport).toHaveBeenCalled();

    await service.sendPasswordResetEmail('a@a.com', 'tok');
    expect(sendMail).toHaveBeenCalled();
  });

  it('збій SMTP не валить виклик (ловиться)', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('smtp down'));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

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
