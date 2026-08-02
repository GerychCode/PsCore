import { pickChangedFields } from './pick-changed-fields';

describe('pickChangedFields', () => {
  it('повертає лише змінені поля', () => {
    expect(pickChangedFields({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: 3 });
  });

  it('нічого не змінилось → порожній обʼєкт', () => {
    expect(pickChangedFields({ a: 1, b: 2 }, { a: 1, b: 2 })).toEqual({});
  });

  it('нове поле (відсутнє в current) вважається зміною', () => {
    expect(pickChangedFields({}, { a: 5 })).toEqual({ a: 5 });
  });
});
