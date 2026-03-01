import {
  Controller,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Req,
  UnauthorizedException,
  Delete,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Request } from 'express';
import { Authorization } from '../common/decorator/auth.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Authorization()
  private getUserId(req: Request): number {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedException('User not authorized');
    return userId;
  }

  @Get()
  @Authorization()
  async getNotifications(@Req() req: Request) {
    const userId = this.getUserId(req);
    return this.notificationsService.getUserNotifications(userId);
  }

  @Patch('read-all')
  @Authorization()
  async markAllAsRead(@Req() req: Request) {
    const userId = this.getUserId(req);
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Patch(':id/read')
  @Authorization()
  async markAsRead(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const userId = this.getUserId(req);
    await this.notificationsService.markAsRead(userId, id);
    return { success: true };
  }

  @Delete(':id')
  @Authorization()
  async deleteNotification(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = this.getUserId(req);
    const deleted = await this.notificationsService.deleteNotification(
      userId,
      id,
    );

    if (!deleted) {
      return {
        success: false,
        message: 'Повідомлення не знайдено або немає доступу',
      };
    }
    return { success: true };
  }
}
