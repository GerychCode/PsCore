import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { Authorized } from '../common/decorator/authorized.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { AssignRolesDto, CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { User } from '../../generated/prisma';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Список прав — доступний тим, хто керує ролями (для UI-конструктора)
  @Get('permissions')
  @RequirePermissions(Permission.MANAGE_ROLES)
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get()
  @RequirePermissions(Permission.MANAGE_ROLES)
  getAll() {
    return this.rolesService.getAll();
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_ROLES)
  create(@Authorized() actor: User, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(actor as any, dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_ROLES)
  update(
    @Authorized() actor: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(actor as any, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_ROLES)
  remove(@Authorized() actor: User, @Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(actor as any, id);
  }

  @Get('user/:userId')
  @RequirePermissions(Permission.MANAGE_ROLES)
  getUserRoles(@Param('userId', ParseIntPipe) userId: number) {
    return this.rolesService.getUserRoles(userId);
  }

  @Put('user/:userId')
  @RequirePermissions(Permission.MANAGE_ROLES)
  setUserRoles(
    @Authorized() actor: User,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignRolesDto,
  ) {
    return this.rolesService.setUserRoles(actor as any, userId, dto.roleIds);
  }
}
