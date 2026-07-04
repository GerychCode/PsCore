import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../permissions/permissions.decorator';
import { Permission } from '../permissions/permission.enum';
import { resolvePermissions } from '../permissions/permissions.util';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const perms = resolvePermissions(request.user ?? {});

    const ok = required.every((p) => perms.has(p));
    if (!ok) {
      throw new ForbiddenException(
        'Недостатньо прав для цієї дії.',
      );
    }
    return true;
  }
}
