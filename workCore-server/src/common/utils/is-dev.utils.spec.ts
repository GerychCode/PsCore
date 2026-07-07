import { IsDev, IsDevEnv } from './is-dev.utils';

describe('is-dev utils', () => {
  it('IsDev повертає true, коли NODE_ENV = development', () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('development'),
    } as any;
    expect(IsDev(configService)).toBe(true);
  });

  it('IsDev повертає false для іншого середовища', () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('production'),
    } as any;
    expect(IsDev(configService)).toBe(false);
  });

  it('IsDevEnv є булевим значенням', () => {
    expect(typeof IsDevEnv).toBe('boolean');
  });
});
