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
import { Authorization } from '../common/decorator/auth.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { AssignRolesDto, CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

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
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_ROLES)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_ROLES)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }

  @Get('user/:userId')
  @RequirePermissions(Permission.MANAGE_ROLES)
  getUserRoles(@Param('userId', ParseIntPipe) userId: number) {
    return this.rolesService.getUserRoles(userId);
  }

  @Put('user/:userId')
  @RequirePermissions(Permission.MANAGE_ROLES)
  setUserRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignRolesDto,
  ) {
    return this.rolesService.setUserRoles(userId, dto.roleIds);
  }
}
