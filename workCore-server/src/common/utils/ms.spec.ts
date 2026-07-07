import ms, { parse, format, parseStrict } from './ms';

describe('ms', () => {
  describe('parse', () => {
    it('перетворює всі одиниці в мілісекунди', () => {
      expect(parse('1ms')).toBe(1);
      expect(parse('1s')).toBe(1000);
      expect(parse('1m')).toBe(60000);
      expect(parse('1h')).toBe(3600000);
      expect(parse('1d')).toBe(86400000);
      expect(parse('1w')).toBe(604800000);
      expect(parse('1y')).toBe(31557600000);
    });

    it('підтримує повні назви, скорочення та пробіли', () => {
      expect(parse('2 hours')).toBe(7200000);
      expect(parse('3 days')).toBe(259200000);
      expect(parse('5 mins')).toBe(300000);
      expect(parse('10 secs')).toBe(10000);
      expect(parse('2 weeks')).toBe(1209600000);
      expect(parse('1 year')).toBe(31557600000);
      expect(parse('100')).toBe(100);
    });

    it('розпізнає всі варіанти написання одиниць', () => {
      const units = [
        'years', 'year', 'yrs', 'yr', 'y',
        'weeks', 'week', 'w',
        'days', 'day', 'd',
        'hours', 'hour', 'hrs', 'hr', 'h',
        'minutes', 'minute', 'mins', 'min', 'm',
        'seconds', 'second', 'secs', 'sec', 's',
        'milliseconds', 'millisecond', 'msecs', 'msec', 'ms',
      ];
      for (const unit of units) {
        expect(parse(`1${unit}`)).not.toBeNaN();
      }
    });

    it('повертає NaN для нерозпізнаного рядка', () => {
      expect(parse('абвгд')).toBeNaN();
    });

    it('кидає помилку для порожнього рядка або задовгого', () => {
      expect(() => parse('')).toThrow();
      expect(() => parse('a'.repeat(101))).toThrow();
      expect(() => parse(123 as any)).toThrow();
    });
  });

  describe('format', () => {
    it('коротке форматування', () => {
      expect(format(500)).toBe('500ms');
      expect(format(1000)).toBe('1s');
      expect(format(60000)).toBe('1m');
      expect(format(3600000)).toBe('1h');
      expect(format(86400000)).toBe('1d');
    });

    it('довге форматування з однини та множини', () => {
      expect(format(500, { long: true })).toBe('500 ms');
      expect(format(1000, { long: true })).toBe('1 second');
      expect(format(60000, { long: true })).toBe('1 minute');
      expect(format(3600000, { long: true })).toBe('1 hour');
      expect(format(86400000, { long: true })).toBe('1 day');
      expect(format(172800000, { long: true })).toBe('2 days');
      expect(format(7200000, { long: true })).toBe('2 hours');
    });

    it('кидає помилку для нечислового або нескінченного значення', () => {
      expect(() => format(NaN)).toThrow();
      expect(() => format(Infinity)).toThrow();
      expect(() => format('x' as any)).toThrow();
    });
  });

  describe('msFn (default export)', () => {
    it('парсить рядок та форматує число', () => {
      expect(ms('1m')).toBe(60000);
      expect(ms(60000)).toBe('1m');
    });

    it('кидає помилку для значення, що не є рядком чи числом', () => {
      expect(() => ms(null as any)).toThrow();
    });
  });

  describe('parseStrict', () => {
    it('делегує до parse', () => {
      expect(parseStrict('1h')).toBe(3600000);
    });
  });
});
