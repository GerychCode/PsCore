import 'reflect-metadata';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Roles, ROLES_KEY } from './role.decorator';
import { Authorization } from './auth.decorator';
import { Authorized } from './authorized.decorator';

function getParamFactory(decorator: any) {
  class TestClass {
    test(@decorator() _value: unknown) {}
  }
  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestClass,
    'test',
  );
  return args[Object.keys(args)[0]].factory;
}

describe('Roles decorator', () => {
  it('встановлює метадані ролей', () => {
    class Target {
      @Roles('Admin' as any)
      handler() {}
    }
    const roles = Reflect.getMetadata(ROLES_KEY, Target.prototype.handler);
    expect(roles).toEqual(['Admin']);
  });
});

describe('Authorization decorator', () => {
  it('повертає декоратор без ролей', () => {
    expect(typeof Authorization()).toBe('function');
  });

  it('повертає декоратор з ролями', () => {
    expect(typeof Authorization('Admin' as any)).toBe('function');
  });
});

describe('Authorized decorator', () => {
  const ctxWith = (user: any) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;

  it('повертає весь обʼєкт користувача', () => {
    const factory = getParamFactory(Authorized);
    const user = { id: 1, role: 'Admin' };
    expect(factory(undefined, ctxWith(user))).toEqual(user);
  });

  it('повертає конкретне поле користувача', () => {
    const factory = getParamFactory(Authorized);
    expect(factory('id', ctxWith({ id: 7 }))).toBe(7);
  });

  it('кидає помилку, якщо користувача немає', () => {
    const factory = getParamFactory(Authorized);
    expect(() => factory(undefined, ctxWith(undefined))).toThrow();
  });
});
