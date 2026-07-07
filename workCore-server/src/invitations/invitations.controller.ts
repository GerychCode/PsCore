import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InvitationsService } from './invitations.service';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  // --- Адмінські (керування користувачами) ---

  @Post()
  @RequirePermissions(Permission.MANAGE_USERS)
  create(@Body() dto: CreateInvitationDto) {
    return this.invitationsService.createInvitation(dto);
  }

  @Post(':userId/send')
  @RequirePermissions(Permission.MANAGE_USERS)
  send(@Param('userId', ParseIntPipe) userId: number) {
    return this.invitationsService.sendInvitationEmail(userId);
  }

  // --- Публічні (користувач ще не залогінений) ---

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get()
  getByToken(@Query('token') token: string) {
    return this.invitationsService.getInvitation(token);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('accept')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.invitationsService.acceptInvitation(dto.token, dto.password);
  }
}
