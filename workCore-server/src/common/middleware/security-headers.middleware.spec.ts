import { SecurityHeadersMiddleware } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  const build = (secure: string) => {
    process.env.SESSION_SECURE = secure;
    return new SecurityHeadersMiddleware();
  };
  const run = (mw: SecurityHeadersMiddleware) => {
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();
    mw.use({} as any, res, next);
    return { res, next };
  };

  afterEach(() => {
    delete process.env.SESSION_SECURE;
  });

  it('ставить базові заголовки і викликає next', () => {
    const { res, next } = run(build('false'));
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(next).toHaveBeenCalled();
  });

  it('без HTTPS не ставить HSTS', () => {
    const { res } = run(build('false'));
    const keys = res.setHeader.mock.calls.map((c: any[]) => c[0]);
    expect(keys).not.toContain('Strict-Transport-Security');
  });

  it('під HTTPS ставить HSTS', () => {
    const { res } = run(build('true'));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.stringContaining('max-age='),
    );
  });
});
