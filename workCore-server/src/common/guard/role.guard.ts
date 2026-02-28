import {CanActivate, ExecutionContext, ForbiddenException, Injectable} from "@nestjs/common";
import {Reflector} from "@nestjs/core";
import {ROLES_KEY} from "../decorator/role.decorator";
import {Role} from "../../../generated/prisma";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass()
        ]);

        const request = context.switchToHttp().getRequest();

        if (!roles) return true;

        if (!roles.includes(request.user.role)) {
            throw new ForbiddenException(
                'Недостаточно прав. У вас нет доступа к этому ресурсу.'
            );
        }

        return true;
    }
}