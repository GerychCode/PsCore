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
import { WorkScheduleService } from './work.schedule.service';
import { ScheduleGeneratorService } from './schedule.generator.service';
import { Authorization } from '../common/decorator/auth.decorator';
import { Authorized } from '../common/decorator/authorized.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { hasPermission } from '../common/permissions/permissions.util';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { FilterWorkScheduleDto } from './dto/filter-work-schedule.dto';
import { User } from '../../generated/prisma';
import { WeekViewQueryDto } from './dto/week-view-query.dto';
import { LockWeekDto } from './dto/lock-week.dto';
import { GenerateWeekDto } from './dto/generate-week.dto';

@Controller('work-schedule')
export class WorkScheduleController {
  constructor(
    private readonly workScheduleService: WorkScheduleService,
    private readonly scheduleGeneratorService: ScheduleGeneratorService,
  ) {}

  @Get()
  @Authorization()
  getWorkSchedules(
    @Authorized() user: User,
    @Query() filterDto: FilterWorkScheduleDto,
  ) {
    return this.workScheduleService.getWorkSchedules(user, filterDto);
  }

  @Get('week-view')
  @Authorization()
  getWeekView(@Authorized() user: User, @Query() query: WeekViewQueryDto) {
    return this.workScheduleService.getWeekView(
      query.date,
      hasPermission(user as any, Permission.MANAGE_SCHEDULE),
    );
  }

  @Post('generate')
  @RequirePermissions(Permission.MANAGE_SCHEDULE)
  generateWeek(@Body() dto: GenerateWeekDto) {
    return this.scheduleGeneratorService.generateWeek(
      dto.departmentId,
      dto.date,
    );
  }

  @Post('generate/publish')
  @RequirePermissions(Permission.MANAGE_SCHEDULE)
  publishWeek(@Body() dto: GenerateWeekDto) {
    return this.scheduleGeneratorService.publishWeek(
      dto.departmentId,
      dto.date,
    );
  }

  @Post('generate/reject')
  @RequirePermissions(Permission.MANAGE_SCHEDULE)
  rejectWeek(@Body() dto: GenerateWeekDto) {
    return this.scheduleGeneratorService.rejectWeek(dto.departmentId, dto.date);
  }

  @Get(':id')
  @Authorization()
  getWorkScheduleById(@Param('id', ParseIntPipe) id: number) {
    return this.workScheduleService.getWorkScheduleById(id);
  }

  @Post()
  @Authorization()
  createWorkSchedule(
    @Authorized() user: User,
    @Body() createDto: CreateWorkScheduleDto,
  ) {
    return this.workScheduleService.createWorkSchedule(user, createDto);
  }

  @Put(':id')
  @Authorization()
  updateWorkSchedule(
    @Authorized() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateWorkScheduleDto,
  ) {
    return this.workScheduleService.updateWorkSchedule(user, id, updateDto);
  }

  @Delete(':id')
  @Authorization()
  deleteWorkSchedule(
    @Authorized() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.workScheduleService.deleteWorkSchedule(user, id);
  }

  @Post('lock')
  @RequirePermissions(Permission.MANAGE_SCHEDULE)
  toggleWeekLock(@Body() dto: LockWeekDto) {
    return this.workScheduleService.toggleWeekLock(dto);
  }
}
