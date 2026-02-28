import { applyDecorators, UseGuards } from '@nestjs/common';
import {AuthGuard} from "../guard/auth.guard";
import {RolesGuard} from "../guard/role.guard";
import {Roles} from "./role.decorator";
import {Role} from "../../../generated/prisma";

export function Authorization(...roles: Role[]) {
    if (roles.length > 0) {
        return applyDecorators(
            Roles(...roles),
            UseGuards(AuthGuard, RolesGuard)
        );
    }
    return applyDecorators(UseGuards(AuthGuard));
}