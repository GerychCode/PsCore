import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ScheduleWishService } from './schedule.wish.service';
import { Authorization } from '../common/decorator/auth.decorator';
import { Authorized } from '../common/decorator/authorized.decorator';
import { CreateWishDto } from './dto/create-wish.dto';

@Controller('schedule-wish')
export class ScheduleWishController {
  constructor(private readonly scheduleWishService: ScheduleWishService) {}

  @Get()
  @Authorization()
  getMyWishes(
    @Authorized('id') userId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.scheduleWishService.getMyWishes(userId, from, to);
  }

  @Post()
  @Authorization()
  addWish(@Authorized('id') userId: number, @Body() dto: CreateWishDto) {
    return this.scheduleWishService.addWish(userId, dto.date);
  }

  @Delete('by-date')
  @Authorization()
  removeByDate(
    @Authorized('id') userId: number,
    @Query('date') date: string,
  ) {
    return this.scheduleWishService.removeWishByDate(userId, date);
  }

  @Delete(':id')
  @Authorization()
  remove(
    @Authorized('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.scheduleWishService.removeWish(userId, id);
  }
}
