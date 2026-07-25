import { fullName } from './full-name';

describe('fullName', () => {
  it('склеює імʼя та прізвище', () => {
    expect(fullName({ firstName: 'Іван', lastName: 'Петренко' })).toBe(
      'Іван Петренко',
    );
  });
});
