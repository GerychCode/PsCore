import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { WorkShiftService } from './work.shift.service';
import { ShiftAutoCloseService } from './shift.autoclose.service';
import { CreateWorkShiftDto } from './dto/create.work.shift.dto';
import { UpdateWorkShiftDto } from './dto/update.work.shift.dto.ts';
import { Authorized } from '../common/decorator/authorized.decorator';
import { Authorization } from '../common/decorator/auth.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { FilterShiftDto } from './dto/shift.filter.dto';
import {$Enums, User} from '../../generated/prisma';
import Role = $Enums.Role;


@Controller('shift')
export class WorkShiftController {
  constructor(
    private readonly workShiftService: WorkShiftService,
    private readonly autoCloseService: ShiftAutoCloseService,
  ) {}

  // Ручний запуск авто-завершення (окрім щоденного опівнічного планувальника)
  @Post('auto-close/run')
  @RequirePermissions(Permission.APPROVE_SHIFTS)
  runAutoClose() {
    return this.autoCloseService.closeActiveShifts();
  }

  @Get()
  @Authorization()
  getWorkShifts(
    @Authorized() user: User,
    @Query() shiftFilterDto: FilterShiftDto,
  ) {
    return this.workShiftService.getWorkShifts(user, shiftFilterDto);
  }

  @Get('/:id')
  @Authorization()
  getWorkShiftById(
    @Authorized() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.workShiftService.getWorkShiftById(id, user);
  }

  @Post()
  @Authorization()
  createWorkShift(
    @Authorized() user: User,
    @Body() createWorkShiftDto: CreateWorkShiftDto,
  ) {
    return this.workShiftService.createWorkShift(user, createWorkShiftDto);
  }

  @Put('/:id')
  @Authorization()
  updateWorkShift(
    @Authorized() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkShiftDto: UpdateWorkShiftDto,
  ) {
    return this.workShiftService.updateWorkShiftDto(
      id,
      updateWorkShiftDto,
      user,
    );
  }

  @Delete('/:id')
  @Authorization()
  deleteWorkShiftById(
    @Authorized() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.workShiftService.deleteShift(user, id);
  }
}
