import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AbsenceService } from './absence.service';
import { Authorization } from '../common/decorator/auth.decorator';
import { Authorized } from '../common/decorator/authorized.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { User } from '../../generated/prisma';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { AbsenceQueryDto } from './dto/absence-query.dto';
import { ReviewAbsenceDto } from './dto/review-absence.dto';

@Controller('absences')
export class AbsenceController {
  constructor(private readonly absenceService: AbsenceService) {}

  @Get()
  @Authorization()
  list(@Authorized() user: User, @Query() query: AbsenceQueryDto) {
    return this.absenceService.list(user, query);
  }

  /** Залишок відпустки. Чужий баланс — лише з правом на графік. */
  @Get('balance')
  @Authorization()
  balance(@Authorized() user: User, @Query('userId') userId?: string) {
    const target = userId ? parseInt(userId, 10) : user.id;
    return this.absenceService.vacationBalance(
      target === user.id ? user.id : this.assertManager(user, target),
    );
  }

  private assertManager(user: User, target: number): number {
    // Перевірку прав робить сам сервіс list/create; тут достатньо не дати
    // підглянути чужий баланс звичайному працівнику.
    const permissions = (user as any).appRoles?.flatMap(
      (r: any) => r.permissions ?? [],
    );
    const allowed =
      (user as any).role === 'Admin' ||
      permissions?.includes(Permission.MANAGE_SCHEDULE) ||
      permissions?.includes(Permission.ADMINISTRATOR);
    return allowed ? target : user.id;
  }

  @Post()
  @Authorization()
  create(@Authorized() user: User, @Body() dto: CreateAbsenceDto) {
    return this.absenceService.create(user, dto);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.MANAGE_SCHEDULE)
  approve(
    @Authorized() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewAbsenceDto,
  ) {
    return this.absenceService.approve(user, id, dto);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.MANAGE_SCHEDULE)
  reject(
    @Authorized() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewAbsenceDto,
  ) {
    return this.absenceService.reject(user, id, dto);
  }

  @Post(':id/cancel')
  @Authorization()
  cancel(@Authorized() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.absenceService.cancel(user, id);
  }
}
