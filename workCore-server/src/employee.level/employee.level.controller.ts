import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { EmployeeLevelService } from './employee.level.service';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

@Controller('employee-level')
export class EmployeeLevelController {
  constructor(private readonly employeeLevelService: EmployeeLevelService) {}

  @Get('ranking')
  @RequirePermissions(Permission.MANAGE_USERS)
  getRanking() {
    return this.employeeLevelService.getRanking();
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_USERS)
  getEmployeeLevel(@Param('id', ParseIntPipe) id: number) {
    return this.employeeLevelService.getEmployeeLevel(id);
  }
}
