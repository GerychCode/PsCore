import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ShiftSwapService } from './shift.swap.service';
import { Authorization } from '../common/decorator/auth.decorator';
import { Authorized } from '../common/decorator/authorized.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { CreateSwapDto } from './dto/create-swap.dto';
import { User } from '../../generated/prisma';

@Controller('shift-swaps')
export class ShiftSwapController {
  constructor(private readonly swapService: ShiftSwapService) {}

  @Get()
  @Authorization()
  list(@Authorized() user: User) {
    return this.swapService.list(user);
  }

  @Post()
  @Authorization()
  create(@Authorized() user: User, @Body() dto: CreateSwapDto) {
    return this.swapService.create(user, dto);
  }

  @Post(':id/claim')
  @Authorization()
  claim(@Authorized() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.swapService.claim(user, id);
  }

  @Post(':id/cancel')
  @Authorization()
  cancel(@Authorized() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.swapService.cancel(user, id);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.MANAGE_SCHEDULE)
  approve(@Authorized() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.swapService.approve(user, id);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.MANAGE_SCHEDULE)
  reject(@Authorized() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.swapService.reject(user, id);
  }
}
