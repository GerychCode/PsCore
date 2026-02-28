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
import { Authorization } from '../common/decorator/auth.decorator';
import { Authorized } from '../common/decorator/authorized.decorator';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { FilterWorkScheduleDto } from './dto/filter-work-schedule.dto';
import { Role, User } from '../../generated/prisma';
import { WeekViewQueryDto } from './dto/week-view-query.dto';
import { LockWeekDto } from './dto/lock-week.dto';

@Controller('work-schedule')
export class WorkScheduleController {
  constructor(private readonly workScheduleService: WorkScheduleService) {}

  @Get()
  @Authorization()
  getWorkSchedules(@Query() filterDto: FilterWorkScheduleDto) {
    return this.workScheduleService.getWorkSchedules(filterDto);
  }

  @Get('week-view')
  @Authorization()
  getWeekView(@Query() query: WeekViewQueryDto) {
    return this.workScheduleService.getWeekView(query.date);
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
  @Authorization(Role.Admin)
  toggleWeekLock(@Body() dto: LockWeekDto) {
    return this.workScheduleService.toggleWeekLock(dto);
  }
}
