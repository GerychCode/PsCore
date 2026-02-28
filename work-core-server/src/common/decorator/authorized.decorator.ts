import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../../generated/prisma';

export const Authorized = createParamDecorator(
  (
    data: keyof User | undefined,
    ctx: ExecutionContext,
  ): User[keyof User] | User => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User | undefined;

    if (!user) {
      throw new Error('Користувача не знайдено!');
    }

    return data ? user[data] : user;
  },
);
