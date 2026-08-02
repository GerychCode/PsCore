import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '../../../generated/prisma';

export const Authorized = createParamDecorator(
  (
    data: keyof User | undefined,
    ctx: ExecutionContext,
  ): User[keyof User] | User => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User | undefined;

    if (!user) {
      // Коректний 401 замість голого Error (→ 500)
      throw new UnauthorizedException('Користувача не авторизовано.');
    }

    return data ? user[data] : user;
  },
);
