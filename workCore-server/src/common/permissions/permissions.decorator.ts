import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guard/auth.guard';
import { PermissionsGuard } from '../guard/permissions.guard';
import { Permission } from './permission.enum';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Захищає роут: спершу автентифікація (AuthGuard кладе user з правами),
 * потім перевірка, що користувач має ВСІ перелічені права.
 */
export function RequirePermissions(...permissions: Permission[]) {
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    UseGuards(AuthGuard, PermissionsGuard),
  );
}
