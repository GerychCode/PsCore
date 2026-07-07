import { LoggerMiddleware } from './logger.middleware';

describe('LoggerMiddleware', () => {
  let middleware: LoggerMiddleware;
  let prisma: any;

  const buildReqRes = (session?: any) => {
    let finishCb: () => Promise<void>;
    const req: any = {
      ip: '127.0.0.1',
      method: 'GET',
      originalUrl: '/test',
      session,
      get: jest.fn().mockReturnValue('jest-agent'),
    };
    const res: any = {
      statusCode: 200,
      get: jest.fn().mockReturnValue('100'),
      on: jest.fn((event: string, cb: () => Promise<void>) => {
        if (event === 'finish') finishCb = cb;
      }),
    };
    return { req, res, fire: () => finishCb() };
  };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    middleware = new LoggerMiddleware(prisma);
  });

  it('логує гостя без сесії та викликає next', async () => {
    const next = jest.fn();
    const { req, res, fire } = buildReqRes(undefined);
    req.get.mockReturnValue(undefined);
    res.get.mockReturnValue(undefined);
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
    await fire();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('логує імʼя авторизованого користувача', async () => {
    prisma.user.findUnique.mockResolvedValue({
      firstName: 'Іван',
      lastName: 'Петренко',
    });
    const { req, res, fire } = buildReqRes({ userId: 1 });
    middleware.use(req, res, jest.fn());
    await fire();
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('використовує ID, якщо користувача не знайдено', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { req, res, fire } = buildReqRes({ userId: 2 });
    middleware.use(req, res, jest.fn());
    await fire();
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('обробляє помилку звернення до БД', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    const errorSpy = jest
      .spyOn((middleware as any).logger, 'error')
      .mockImplementation(() => {});
    const { req, res, fire } = buildReqRes({ userId: 3 });
    middleware.use(req, res, jest.fn());
    await fire();
    expect(errorSpy).toHaveBeenCalled();
  });
});
