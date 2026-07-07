import { parseBoolean } from './boolean-parser';

describe('parseBoolean', () => {
  it('повертає true лише для рядка "true"', () => {
    expect(parseBoolean('true')).toBe(true);
  });

  it('повертає false для "false"', () => {
    expect(parseBoolean('false')).toBe(false);
  });

  it('повертає false для будь-якого іншого значення', () => {
    expect(parseBoolean('1')).toBe(false);
    expect(parseBoolean('TRUE')).toBe(false);
    expect(parseBoolean('')).toBe(false);
  });
});
